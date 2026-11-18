/**
 * TutorSphere realtime service (port 3003)
 * - Conversation message relay (rooms: conv:<id>)
 * - Live classroom WebRTC signaling (rooms: lesson:<roomId>)
 * - Shared whiteboard + in-class chat relay
 * All joins require a signed token issued by the Next.js API (HMAC-SHA256, shared secret).
 */
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'
import { createHmac, timingSafeEqual, randomUUID } from 'crypto'
import { registerGameHandlers, roomSummaries } from './games'
import { getBoard,currentPage,setCurrentStrokes,registerBoardPages,boardDocuments } from './board-pages'
import { validStroke } from '../../src/lib/board-document'
import { classroomAccess,removeAssets } from '../../src/lib/media-storage'
import { db } from '../../src/lib/db'
import { getLessonCall, updateLessonCall, type LessonCall } from '../../src/lib/lesson-calls'
import { chooseBoardStudent, mayWriteBoard, type BoardAccess } from '../../src/lib/whiteboard-policy'

const SESSION_SECRET = process.env.SESSION_SECRET || 'tutorsphere-dev-secret-change-in-production'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || SESSION_SECRET

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // NOTE: socket.io (path '/') handles normal traffic; this handler is a guarded
  // fallback only. Internal room listings are served via the 'game:rooms' socket
  // event (see games.ts) because socket.io owns the request path.
  if (res.headersSent) return
  if (req.url?.startsWith('/internal/rooms') && req.headers['x-internal-secret'] === INTERNAL_SECRET) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ rooms: roomSummaries() }))
    return
  }
  if (!res.writableEnded && !res.headersSent) {
    res.writeHead(404)
    res.end()
  }
})
const io = new Server(httpServer, {
  path: '/',
  maxHttpBufferSize: 2 * 1024 * 1024,
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface TokenPayload {
  bookingId: string
  roomId: string
  userId: string
  name: string
  role: 'tutor' | 'student'
  exp: number
  callId?: string
  groupClassId?: string
  conversationId?: string
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const [data, sig] = token.split('.')
    const expected = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) return null
    return parsed as TokenPayload
  } catch {
    return null
  }
}

interface Peer { socketId: string; userId: string; name: string; role: string }
const lessonPeers = new Map<string, Map<string, Peer>>()
const whiteboards = new Map<string, unknown[]>()
const boardPermissions = new Map<string, BoardAccess>()
const classroomMessageIds = new Map<string, Set<string>>()
const activeCalls = new Map<string, { room: string; snapshot: string }>()
const activeLessons=new Map<string,{endsAt:number;groupClassId?:string;callId?:string}>()
async function closeRoom(roomId:string,reason='completed',call=false){
 const room='lesson:'+roomId
 io.to(room).emit('wb_final_snapshot',getBoard(roomId))
 io.to(room).emit(call?'call_ended':'lesson_ended',{reason})
 for(const connection of io.sockets.sockets.values())if(connection.data.lessonRoom===room){connection.leave(room);connection.data.lessonRoom=undefined;connection.data.peer=undefined;connection.data.lessonContext=undefined}
 lessonPeers.delete(roomId);whiteboards.delete(roomId);boardPermissions.delete(roomId);classroomMessageIds.delete(roomId);boardDocuments.delete(roomId);activeLessons.delete(roomId)
 await removeAssets({scope:'classroom',scopeId:roomId})
}
let checkingCalls = false
const callMonitor = setInterval(async () => {
  if (checkingCalls) return
  checkingCalls = true
  try {
    for (const [id, state] of activeCalls) {
      const call = await getLessonCall(id)
      if (!call || call.status === 'ended') {
        await closeRoom(state.room.replace('lesson:',''),call?.endReason || 'hangup',true);activeCalls.delete(id)
      } else if (JSON.stringify(call) !== state.snapshot) {
        state.snapshot = JSON.stringify(call); io.to(state.room).emit('call_state', call)
      }
    }
    for(const [roomId,state] of activeLessons){
      if(state.callId)continue
      const ended=await db.setting.findUnique({where:{key:'classroom-ended:'+roomId}})
      if(ended||Date.now()>state.endsAt)await closeRoom(roomId)
    }
  } catch (error) { console.error('Call monitor:', error) }
  finally { checkingCalls = false }
}, 1000)
callMonitor.unref()
const mediaCleanup=setInterval(()=>{void removeAssets({scope:'classroom',expiresAt:{lt:new Date()}}).catch(error=>console.error('Lesson media cleanup:',error))},60000);mediaCleanup.unref()

io.on('connection', (socket: Socket) => {
  console.log('socket connected', socket.id)
  registerGameHandlers(io, socket)
  registerBoardPages(io,socket,whiteboards)

  // ---------- Messaging ----------
  socket.on('join_conversation', (data: { conversationId: string; token: string }, ack?: (response: { ok: boolean }) => void) => {
    const payload = verifyToken(data.token)
    if (!payload || payload.conversationId !== data.conversationId) { ack?.({ ok: false }); socket.emit('auth_error', { message: 'Invalid conversation token' }); return }
    socket.join(`conv:${data.conversationId}`)
    socket.data.conversationUser = { id: payload.userId, name: payload.name }
    ack?.({ ok: true })
  })

  socket.on('typing', (data: { conversationId: string; userId: string; name: string }) => {
    if (!socket.rooms.has(`conv:${data.conversationId}`)) return
    socket.to(`conv:${data.conversationId}`).emit('typing', { userId: socket.data.conversationUser.id, name: socket.data.conversationUser.name,conversationId:data.conversationId })
  })

  socket.on('stop_typing', (data: { conversationId: string; userId: string }) => {
    if (!socket.rooms.has(`conv:${data.conversationId}`)) return
    socket.to(`conv:${data.conversationId}`).emit('stop_typing', { userId: socket.data.conversationUser.id,conversationId:data.conversationId })
  })

  socket.on('message_relay', async (data: { conversationId: string; message: { id?: string } }) => {
    if (!socket.rooms.has(`conv:${data.conversationId}`) || !data.message?.id) return
    const message = await db.message.findFirst({ where: { id: data.message.id, conversationId: data.conversationId, senderId: socket.data.conversationUser.id }, include: { sender: { select: { name: true } },reactions:true } })
    if (message) socket.to(`conv:${data.conversationId}`).emit('message', { conversationId: data.conversationId, message })
  })

  socket.on('reaction_relay',async(data:{conversationId:string;messageId:string})=>{
    if(!socket.rooms.has('conv:'+data.conversationId))return
    const message=await db.message.findFirst({where:{id:data.messageId,conversationId:data.conversationId},include:{reactions:true}})
    if(message)socket.to('conv:'+data.conversationId).emit('message',{conversationId:data.conversationId,message})
  })
  // ---------- Classroom ----------
  socket.on('join_lesson', async (data: { token: string }, ack?: (res: { ok: boolean; error?: string; peers?: Peer[]; strokes?: unknown[]; document?:unknown; call?: LessonCall; boardAccess?: BoardAccess }) => void) => {
    const payload = verifyToken(data.token)
    if (!payload || !payload.roomId || !payload.bookingId) {
      ack?.({ ok: false, error: 'Invalid or expired classroom token' })
      return
    }
    const room = `lesson:${payload.roomId}`
    let endsAt=Date.now()+3*3600000
    if(!await classroomAccess(payload,payload.userId)||await db.setting.findUnique({where:{key:'classroom-ended:'+payload.roomId}})){ack?.({ok:false,error:'This classroom is not available'});return}
    if(payload.groupClassId){
      const group=await db.groupClass.findUnique({where:{id:payload.groupClassId},include:{enrollments:{where:{status:'CONFIRMED'}}}})
      if(!group||group.enrollments.length<group.minStudents){ack?.({ok:false,error:'At least five confirmed members are required'});return}
      endsAt=+group.startUtc+(group.durationMin+45)*60000
    }else if(!payload.callId){const booking=await db.booking.findUnique({where:{id:payload.bookingId}});if(booking)endsAt=+booking.endUtc+45*60000}
    let call: LessonCall | undefined
    if (payload.callId) {
      try {
        const stored = await getLessonCall(payload.callId)
        if (!stored || stored.bookingId !== payload.bookingId || stored.roomId !== payload.roomId || stored.status === 'ended') throw new Error('This call has ended')
        call = await updateLessonCall(payload.callId, payload.userId, 'join')
        activeCalls.set(call.id, { room, snapshot: '' })
      } catch (error) { ack?.({ ok: false, error: error instanceof Error ? error.message : 'Call unavailable' }); return }
    }
    socket.join(room)
    socket.data.lessonRoom = room
    socket.data.lessonContext = payload
    activeLessons.set(payload.roomId,{endsAt,groupClassId:payload.groupClassId,callId:payload.callId})
    socket.data.peer = { socketId: socket.id, userId: payload.userId, name: payload.name, role: payload.role }

    if (!lessonPeers.has(payload.roomId)) lessonPeers.set(payload.roomId, new Map())
    const peers = lessonPeers.get(payload.roomId)!
    peers.set(socket.id, { socketId: socket.id, userId: payload.userId, name: payload.name, role: payload.role })

    whiteboards.set(payload.roomId,currentPage(payload.roomId).strokes)
    if (!boardPermissions.has(payload.roomId)) boardPermissions.set(payload.roomId, { locked: true, studentId: null })
    const strokes = whiteboards.get(payload.roomId)!

    socket.to(room).emit('peer_joined', { socketId: socket.id, userId: payload.userId, name: payload.name, role: payload.role })
    const others = [...peers.values()].filter((p) => p.socketId !== socket.id)
    ack?.({ ok: true, peers: others, strokes, document:getBoard(payload.roomId), boardAccess: boardPermissions.get(payload.roomId), ...(call ? { call } : {}) })
    if (call) io.to(room).emit('call_state', call)

    console.log(`peer ${payload.name} joined lesson room ${payload.roomId} (${peers.size} in room)`)
  })

  const canSignalPeer = (toSocketId: string) => {
    const room = socket.data.lessonRoom
    return Boolean(room && io.sockets.sockets.get(toSocketId)?.data.lessonRoom === room)
  }
  const canWriteBoard = () => {
    const room = socket.data.lessonRoom as string | undefined
    const peer = socket.data.peer as Peer | undefined
    return Boolean(room && peer && mayWriteBoard(peer.role, peer.userId, boardPermissions.get(room.replace('lesson:', '')) || { locked: true, studentId: null }))
  }
  socket.on('wb_access', (data: { locked: boolean; studentId?: string }, ack?: (response: { ok: boolean; error?: string }) => void) => {
    const room = socket.data.lessonRoom as string | undefined; const peer = socket.data.peer as Peer | undefined
    if (!room || peer?.role !== 'tutor') { ack?.({ ok: false, error: 'Only the teacher controls whiteboard access' }); return }
    try {
      const roomId = room.replace('lesson:', '')
      const students = [...(lessonPeers.get(roomId)?.values() || [])].filter((person) => person.role === 'student').map((person) => person.userId)
      const access: BoardAccess = data.locked ? { locked: true, studentId: null } : { locked: false, studentId: chooseBoardStudent(students, data.studentId) }
      boardPermissions.set(roomId, access); io.to(room).emit('wb_access', access); ack?.({ ok: true })
    } catch (error) { ack?.({ ok: false, error: error instanceof Error ? error.message : 'Could not update access' }) }
  })
  socket.on('lesson_game_invite', async (data: { invitationId: string }) => {
    const room = socket.data.lessonRoom as string | undefined; const peer = socket.data.peer as Peer | undefined
    if (!room || peer?.role !== 'tutor') return
    const invitation = await db.gameInvitation.findUnique({ where: { id: data.invitationId } })
    if (!invitation || invitation.fromUserId !== peer.userId || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) return
    for (const person of lessonPeers.get(room.replace('lesson:', ''))?.values() || []) if (person.userId === invitation.toUserId) io.to(person.socketId).emit('game_invitation_pending')
  })
  socket.on('rtc_offer', (data: { toSocketId: string; sdp: unknown }) => {
    if (!canSignalPeer(data.toSocketId)) return
    io.to(data.toSocketId).emit('rtc_offer', { fromSocketId: socket.id, sdp: data.sdp })
  })
  socket.on('rtc_answer', (data: { toSocketId: string; sdp: unknown }) => {
    if (!canSignalPeer(data.toSocketId)) return
    io.to(data.toSocketId).emit('rtc_answer', { fromSocketId: socket.id, sdp: data.sdp })
  })
  socket.on('rtc_ice', (data: { toSocketId: string; candidate: unknown }) => {
    if (!canSignalPeer(data.toSocketId)) return
    io.to(data.toSocketId).emit('rtc_ice', { fromSocketId: socket.id, candidate: data.candidate })
  })

  socket.on('wb_stroke', (data: { stroke: unknown;pageId?:string }) => {
    if (!canWriteBoard()) return
    const room = socket.data.lessonRoom as string | undefined
    if (!room) return
    const roomId = room.replace('lesson:', '')
    if(data.pageId&&data.pageId!==getBoard(roomId).activePageId||!validStroke(data.stroke))return
    const strokes = whiteboards.get(roomId)
    if (strokes) {
      if(strokes.some(stroke=>(stroke as {id?:string}).id===(data.stroke as {id:string}).id))return
      strokes.push(data.stroke)
      if (strokes.length > 2000) strokes.splice(0, strokes.length - 2000)
    }
    socket.to(room).emit('wb_stroke', { stroke:data.stroke,pageId:getBoard(roomId).activePageId })
  })
  socket.on('wb_clear', (data?:{pageId?:string}) => {
    if (!canWriteBoard()) return
    const room = socket.data.lessonRoom as string | undefined
    if (!room) return
    const roomId=room.replace('lesson:','');if(data?.pageId&&data.pageId!==getBoard(roomId).activePageId)return
    whiteboards.set(roomId,[]);setCurrentStrokes(roomId,[])
    socket.to(room).emit('wb_clear')
  })
  socket.on('wb_undo', (data?:{pageId?:string}) => {
    if (!canWriteBoard()) return
    const room = socket.data.lessonRoom as string | undefined
    if (!room) return
    if(data?.pageId&&data.pageId!==getBoard(room.replace('lesson:','')).activePageId)return
    const strokes = whiteboards.get(room.replace('lesson:', ''))
    if (strokes?.length) strokes.pop()
    socket.to(room).emit('wb_undo')
  })

  socket.on('lesson_chat', async (data: { body: string; clientId?: string;attachmentId?:string }) => {
    const room = socket.data.lessonRoom as string | undefined
    const peer = socket.data.peer as Peer | undefined
    if (!room || !peer) return
    const body = String(data.body).trim().slice(0, 2000)
    const asset=data.attachmentId?await db.mediaAsset.findFirst({where:{id:data.attachmentId,scope:'classroom',scopeId:room.replace('lesson:',''),ownerId:peer.userId,mime:{startsWith:'image/'}}}):null
    if(data.attachmentId&&!asset||!body&&!asset)return
    const roomId = room.replace('lesson:', '')
    const id = `${peer.userId}:${typeof data.clientId === 'string' ? data.clientId.slice(0, 100) : randomUUID()}`
    const seen = classroomMessageIds.get(roomId) || new Set<string>()
    if (seen.has(id)) return
    seen.add(id); if (seen.size > 500) seen.delete(seen.values().next().value!); classroomMessageIds.set(roomId, seen)
    io.to(room).emit('lesson_chat', { id, from: { name: peer.name, role: peer.role, userId: peer.userId }, body, at: Date.now(),...(asset?{imageUrl:'/api/media/'+asset.id}:{}) })
  })

  socket.on('leave_lesson', () => {
    const room = socket.data.lessonRoom as string | undefined
    if (room) {
      socket.leave(room)
      const peers = lessonPeers.get(room.replace('lesson:', ''))
      peers?.delete(socket.id)
      socket.to(room).emit('peer_left', { socketId: socket.id })
      socket.data.lessonRoom = undefined
    }
  })

  socket.on('disconnect', () => {
    const room = socket.data.lessonRoom as string | undefined
    if (room) {
      const peers = lessonPeers.get(room.replace('lesson:', ''))
      peers?.delete(socket.id)
      socket.to(room).emit('peer_left', { socketId: socket.id })
    }
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`TutorSphere realtime service listening on port ${PORT}`)
})

process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)) })
process.on('SIGINT', () => { httpServer.close(() => process.exit(0)) })
