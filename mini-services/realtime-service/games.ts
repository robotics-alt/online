/**
 * Brain Games engine — server-authoritative multiplayer for TutorSphere.
 *
 * All competitive logic (turns, legality, scoring, timing) lives here.
 * The browser only renders state and sends intents; scores computed from
 * browser submissions are never trusted for multiplayer matches.
 *
 * Persisted via Prisma (resolves the host project's generated client).
 * NOTE: solo score caps live in src/lib/games-config.ts — keep thresholds aligned.
 */
import { Server, Socket } from 'socket.io'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '../../src/lib/db'

const SESSION_SECRET = process.env.SESSION_SECRET || 'tutorsphere-dev-secret-change-in-production'
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:' + new URL('../../../db/custom.db', import.meta.url).pathname
}


export interface GameTokenPayload {
  userId: string
  name: string
  role: string
  avatarUrl?: string | null
  exp: number
}

export function verifyGameToken(token: string): GameTokenPayload | null {
  try {
    const [data, sig] = token.split('.')
    const expected = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) return null
    return parsed as GameTokenPayload
  } catch {
    return null
  }
}

// ---------- Room model ----------
type Engine = 'tictactoe' | 'memory' | 'quickmath'

interface Player {
  userId: string
  name: string
  avatarUrl?: string | null
  seat: number
  ready: boolean
  connected: boolean
  isHost: boolean
  score: number
  answeredCurrent: boolean
}

interface Session {
  code: string
  gameId: string
  slug: string
  engine: Engine
  mode: 'DUEL' | 'GROUP'
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  maxPlayers: number
  timeLimitSec: number
  status: 'LOBBY' | 'PLAYING' | 'FINISHED'
  players: Map<string, Player> // by userId
  state: unknown
  matchId?: string
  startedAt?: number
  lastActivity: number
  timers: ReturnType<typeof setTimeout>[]
}

const rooms = new Map<string, Session>() // by code
const userSockets = new Map<string, Set<string>>() // userId -> socket ids

function roomCode(code: string) {
  return `game:${code}`
}

function roster(s: Session) {
  return [...s.players.values()].map((p) => ({
    userId: p.userId, name: p.name, avatarUrl: p.avatarUrl ?? null, seat: p.seat,
    ready: p.ready, connected: p.connected, isHost: p.isHost, score: p.score,
  }))
}

function publicState(s: Session) {
  return { code: s.code, slug: s.slug, engine: s.engine, mode: s.mode, difficulty: s.difficulty, status: s.status, maxPlayers: s.maxPlayers, players: roster(s), state: s.state }
}

function later(s: Session, ms: number, fn: () => void) {
  const t = setTimeout(() => {
    s.timers = s.timers.filter((x) => x !== t)
    fn()
  }, ms)
  s.timers.push(t)
  s.lastActivity = Date.now()
}

function clearTimers(s: Session) {
  for (const t of s.timers) clearTimeout(t)
  s.timers = []
}

// ---------- Achievements (kept in sync with src/lib/games-awards.ts) ----------
async function persistMatch(io: Server, s: Session, winnerUserId: string | null, winnerTeam: string | null) {
  const durationSec = Math.round((Date.now() - (s.startedAt ?? Date.now())) / 1000)
  const players = [...s.players.values()]
  let best = -1
  let topUser: string | null = null
  for (const p of players) if (p.score > best) { best = p.score; topUser = p.userId }
  try {
    const match = await db.gameMatch.create({
      data: {
        gameId: s.gameId, roomId: s.code ? (await db.gameRoom.findUnique({ where: { code: s.code } }))?.id : undefined,
        mode: s.mode, difficulty: s.difficulty, status: 'FINISHED',
        winnerUserId: winnerUserId ?? (winnerTeam ? null : topUser), winnerTeam,
        durationSec, endedAt: new Date(), startedAt: s.startedAt ? new Date(s.startedAt) : undefined,
        players: {
          create: players.map((p) => ({
            userId: p.userId, name: p.name, score: p.score,
            result: winnerTeam ? (p.score === best ? 'WIN' : 'LOSS') : p.userId === (winnerUserId ?? topUser) ? 'WIN' : 'LOSS',
            stats: JSON.stringify({}),
          })),
        },
      },
    })
    // Achievements for every participant
    for (const p of players) {
      const totalMatches = await db.gameMatchPlayer.count({ where: { userId: p.userId } })
      const totalWins = await db.gameMatchPlayer.count({ where: { userId: p.userId, result: 'WIN' } })
      const codes: string[] = ['FIRST_PLAY']
      const won = winnerTeam ? p.score === best : p.userId === (winnerUserId ?? topUser)
      if (won) {
        codes.push('FIRST_WIN')
        if (s.slug === 'tic-tac-toe') codes.push('TTT_STRATEGIST')
        if (s.slug === 'memory-match') codes.push('MEMORY_MASTER')
        if (s.slug === 'quick-math') codes.push('MATH_CHAMPION')
        if (totalWins >= 5) codes.push('FIVE_STREAK')
      }
      if (totalMatches >= 10) codes.push('GOOD_SPORT')
      for (const code of codes) {
        const def = await db.gameAchievement.findUnique({ where: { code } })
        if (!def) continue
        const existing = await db.userGameAchievement.findUnique({
          where: { userId_achievementId: { userId: p.userId, achievementId: def.id } },
        })
        if (!existing) {
          await db.userGameAchievement.create({ data: { userId: p.userId, achievementId: def.id, matchId: match.id } })
          io.to(roomCode(s.code)).emit('game:achievement', { userId: p.userId, name: p.name, code, name_: def.name, icon: def.icon })
        }
      }
    }
  } catch (err) {
    console.error('persistMatch failed', err)
  }
}

function finishSession(io: Server, s: Session, winnerUserId: string | null, winnerTeam: string | null) {
  s.status = 'FINISHED'
  clearTimers(s)
  void persistMatch(io, s, winnerUserId, winnerTeam)
  io.to(roomCode(s.code)).emit('game:state', publicState(s))
  io.to(roomCode(s.code)).emit('game:over', { winnerUserId, winnerTeam, players: roster(s) })
  later(s, 30 * 60 * 1000, () => destroyRoom(s.code))
}

function destroyRoom(code: string) {
  const s = rooms.get(code)
  if (!s) return
  clearTimers(s)
  rooms.delete(code)
}

// ---------- Engines ----------
interface TTTState {
  board: (string | null)[]
  turn: number
  round: number
  wins: number[]
  finished: boolean
  roundOver: boolean
  line: number[] | null
  roundWinner: number | 'draw' | null
  matchWinner: number | null
}
function initTicTacToe(): TTTState {
  return { board: Array(9).fill(null), turn: 0, round: 1, wins: [0, 0], finished: false, roundOver: false, line: null, roundWinner: null, matchWinner: null }
}
const TTT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
function tttWinner(b: (string | null)[]): { mark: string; line: number[] } | null {
  for (const l of TTT_LINES) {
    const [a, c, d] = l
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { mark: b[a]!, line: l }
  }
  return null
}

interface MemoryState {
  deck: number[]
  flipped: number[]
  matched: boolean[]
  turn: number
  scores: number[]
  busy: boolean
  finished: boolean
  missStreak: number[]
}
function initMemory(): MemoryState {
  const pairs = 8
  const deck: number[] = []
  for (let i = 0; i < pairs; i++) deck.push(i, i)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return { deck, flipped: [], matched: Array(pairs * 2).fill(false), turn: 0, scores: [0, 0], busy: false, finished: false, missStreak: [0, 0] }
}

function mathQuestion(difficulty: Session['difficulty']): { text: string; answer: string } {
  const ri = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
  if (difficulty === 'EASY') {
    const a = ri(2, 20), b = ri(1, 20)
    return Math.random() < 0.5 ? { text: `${a} + ${b} = ?`, answer: String(a + b) } : { text: `${Math.max(a,b)} − ${Math.min(a,b)} = ?`, answer: String(Math.abs(a - b)) }
  }
  if (difficulty === 'MEDIUM') {
    const r = Math.random()
    if (r < 0.4) { const a = ri(3, 12), b = ri(3, 12); return { text: `${a} × ${b} = ?`, answer: String(a * b) } }
    if (r < 0.7) { const b = ri(3, 12), q = ri(3, 12); return { text: `${b * q} ÷ ${b} = ?`, answer: String(q) } }
    const a = ri(15, 99), b = ri(15, 99)
    return Math.random() < 0.5 ? { text: `${a} + ${b} = ?`, answer: String(a + b) } : { text: `${Math.max(a,b)} − ${Math.min(a,b)} = ?`, answer: String(Math.abs(a - b)) }
  }
  const r = Math.random()
  if (r < 0.3) { const b = ri(2, 9), n = ri(2, 9) * b; return { text: `${n}/10 + ${b}/10 = ? (as a decimal)`, answer: String(n / 10 + b / 10) } }
  if (r < 0.6) { const p = [10, 20, 25, 50][ri(0, 3)], n = ri(2, 20) * 4; return { text: `${p}% of ${n} = ?`, answer: String((p / 100) * n) } }
  const x = ri(2, 12), a = ri(2, 9), c = ri(1, 20)
  return { text: `${a}x + ${c} = ${a * x + c},  x = ?`, answer: String(x) }
}

interface MathState {
  qSeq: number
  totalQuestions: number
  question: { text: string; answer: string } | null
  endsAt: number | null
  reveal: string | null
  finished: boolean
  answered: Record<string, { correct: boolean; points: number }>
}
function initQuickMath(): MathState {
  return { qSeq: 0, totalQuestions: 10, question: null, endsAt: null, reveal: null, finished: false, answered: {} }
}

function nextMathQuestion(io: Server, s: Session) {
  const st = s.state as ReturnType<typeof initQuickMath>
  if (st.qSeq >= st.totalQuestions) {
    finishSession(io, s, null, null)
    return
  }
  st.qSeq += 1
  st.question = mathQuestion(s.difficulty)
  st.endsAt = Date.now() + 15000
  st.answered = {}
  st.reveal = null
  io.to(roomCode(s.code)).emit('game:state', publicState(s))
  later(s, 15000, () => {
    if (s.status !== 'PLAYING') return
    const cur = s.state as ReturnType<typeof initQuickMath>
    if (cur.qSeq !== st.qSeq) return
    cur.reveal = String(st.question?.answer ?? '')
    io.to(roomCode(s.code)).emit('game:state', publicState(s))
    later(s, 1800, () => nextMathQuestion(io, s))
  })
}

function startPlaying(io: Server, s: Session) {
  s.status = 'PLAYING'
  s.startedAt = Date.now()
  for (const p of s.players.values()) p.score = 0
  if (s.engine === 'tictactoe') s.state = initTicTacToe()
  else if (s.engine === 'memory') s.state = initMemory()
  else s.state = initQuickMath()
  void (async () => {
    try {
      const roomRow = await db.gameRoom.update({ where: { code: s.code }, data: { status: 'PLAYING' } })
      s.gameId = roomRow.gameId
    } catch { /* room row may not exist for ad-hoc rooms */ }
  })()
  io.to(roomCode(s.code)).emit('game:started', publicState(s))
  if (s.engine === 'quickmath') later(s, 1200, () => nextMathQuestion(io, s))
}

// ---------- Registration ----------
export function registerGameHandlers(io: Server, socket: Socket) {
  const myRooms = new Set<string>()

  // Internal room listing for the admin panel (secret-based, no user token)
  socket.on('game:rooms', (data: { secret?: string }, ack?: (res: { ok: boolean; rooms?: unknown[] }) => void) => {
    const secret = process.env.INTERNAL_SECRET || SESSION_SECRET
    if (data.secret !== secret) return ack?.({ ok: false })
    ack?.({ ok: true, rooms: roomSummaries() })
  })

  const broadcast = (s: Session) => io.to(roomCode(s.code)).emit('game:state', publicState(s))

  function handleDisconnect() {
    for (const code of myRooms) {
      const s = rooms.get(code)
      if (!s) continue
      const userId = socket.data.gameUserId as string | undefined
      const p = userId ? s.players.get(userId) : undefined
      if (!p) continue
      p.connected = false
      broadcast(s)
      if (s.status === 'PLAYING') {
        // Grace period, then forfeit
        later(s, 45000, () => {
          const cur = rooms.get(code)
          if (!cur || cur.status !== 'PLAYING') return
          const pl = cur.players.get(p.userId)
          if (pl && !pl.connected) {
            const others = [...cur.players.values()].filter((x) => x.connected)
            finishSession(io, cur, others.length === 1 ? others[0].userId : null, null)
          }
        })
      } else if (s.status === 'LOBBY') {
        later(s, 10000, () => {
          const cur = rooms.get(code)
          if (!cur || cur.status !== 'LOBBY') return
          const pl = cur.players.get(p.userId)
          if (pl && !pl.connected) {
            const wasHost = pl.isHost
            cur.players.delete(p.userId)
            if (wasHost) {
              const next = [...cur.players.values()].sort((a, b) => a.seat - b.seat)[0]
              if (next) next.isHost = true
            }
            broadcast(cur)
          }
        })
      }
      // Host transfer even while playing (disconnected host)
      if (p.isHost) {
        const next = [...s.players.values()].filter((x) => x.connected).sort((a, b) => a.seat - b.seat)[0]
        if (next) next.isHost = true
      }
    }
  }

  socket.on('game:join', async (data: { token: string; roomCode: string }, ack?: (res: { ok: boolean; error?: string; session?: unknown }) => void) => {
    const payload = verifyGameToken(data.token)
    if (!payload) return ack?.({ ok: false, error: 'Invalid or expired session token' })
    if (payload.role === 'STUDENT') {
      const invitedRoom = await db.gameRoom.findUnique({ where: { code: data.roomCode.toUpperCase() } })
      const host = invitedRoom ? await db.user.findUnique({ where: { id: invitedRoom.hostUserId }, select: { role: true } }) : null
      const invitation = invitedRoom && host?.role === 'TUTOR' ? await db.gameInvitation.findFirst({ where: { roomId: invitedRoom.id, fromUserId: invitedRoom.hostUserId, toUserId: payload.userId, status: 'ACCEPTED' } }) : null
      if (!invitation) return ack?.({ ok: false, error: 'Accept a game invitation from your teacher before joining' })
    }
    let s = rooms.get(data.roomCode.toUpperCase())
    if (!s) {
      // Lazy hydration: rebuild the session from the DB row (service restart recovery)
      try {
        const row = await db.gameRoom.findUnique({
          where: { code: data.roomCode.toUpperCase() },
          include: { game: true },
        })
        if (row && (row.status === 'LOBBY' || row.status === 'PLAYING')) {
          const engine: Engine | null =
            row.game.slug === 'tic-tac-toe' ? 'tictactoe' :
            row.game.slug === 'memory-match' ? 'memory' :
            row.game.slug === 'quick-math' ? 'quickmath' : null
          if (engine) {
            s = {
              code: row.code, gameId: row.gameId, slug: row.game.slug, engine: engine as Engine,
              mode: row.mode === 'GROUP' ? 'GROUP' : 'DUEL',
              difficulty: (['EASY', 'MEDIUM', 'HARD'].includes(row.difficulty) ? row.difficulty : 'MEDIUM') as Session['difficulty'],
              maxPlayers: row.maxPlayers, timeLimitSec: row.timeLimitSec,
              status: row.status === 'PLAYING' ? 'PLAYING' : 'LOBBY',
              players: new Map(), state: {}, startedAt: undefined, lastActivity: Date.now(), timers: [],
            }
            if (s.status === 'PLAYING') {
              // A match was in progress but state was lost on restart — abort honestly.
              s.status = 'FINISHED'
              await db.gameRoom.update({ where: { code: s.code }, data: { status: 'FINISHED' } })
            }
            rooms.set(s.code, s)
          }
        }
      } catch (err) {
        console.error('room hydration failed', err)
      }
    }
    if (!s) return ack?.({ ok: false, error: 'Room not found or expired' })
    const room = roomCode(s.code)
    // Reconnect: drop old sockets of this user
    const prev = s.players.get(payload.userId)
    if (prev && !prev.connected) prev.connected = true
    socket.data.gameUserId = payload.userId
    socket.data.gameRoomCode = s.code
    myRooms.add(s.code)
    socket.join(room)

    if (!prev) {
      if (s.status !== 'LOBBY') return ack?.({ ok: false, error: 'This match has already started' })
      if (s.players.size >= s.maxPlayers) return ack?.({ ok: false, error: 'Room is full' })
      // Host authority comes from the DB row (creator of the room).
      let seat = s.players.size
      let isHost = s.players.size === 0
      try {
        const row = await db.gameRoom.findUnique({ where: { code: s.code }, select: { hostUserId: true } })
        if (row) {
          isHost = row.hostUserId === payload.userId
          if (isHost && seat !== 0) {
            // Free seat 0 for the DB host; previous occupant moves to the back
            const cur = [...s.players.values()].find((x) => x.seat === 0)
            if (cur) { cur.seat = seat; cur.isHost = false }
            seat = 0
          }
        }
      } catch { /* fall back to first-joiner-is-host */ }
      s.players.set(payload.userId, {
        userId: payload.userId, name: payload.name, avatarUrl: payload.avatarUrl ?? null,
        seat, ready: false, connected: true, isHost, score: 0, answeredCurrent: false,
      })
    } else {
      prev.name = payload.name
      prev.avatarUrl = payload.avatarUrl ?? null
    }
    s.lastActivity = Date.now()
    ack?.({ ok: true, session: publicState(s) })
    broadcast(s)
  })

  socket.on('game:ready', (data: { ready: boolean }, ack?: (res: { ok: boolean }) => void) => {
    const s = rooms.get(socket.data.gameRoomCode as string)
    const userId = socket.data.gameUserId as string
    const p = s?.players.get(userId)
    if (!s || !p || s.status !== 'LOBBY') return ack?.({ ok: false })
    p.ready = !!data.ready
    ack?.({ ok: true })
    broadcast(s)
  })

  socket.on('game:start', (data: { difficulty?: 'EASY' | 'MEDIUM' | 'HARD'; timeLimitSec?: number }, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const s = rooms.get(socket.data.gameRoomCode as string)
    const userId = socket.data.gameUserId as string
    const host = s?.players.get(userId)
    if (!s || !host?.isHost) return ack?.({ ok: false, error: 'Only the host can start' })
    if (s.status !== 'LOBBY') return ack?.({ ok: false, error: 'Already started' })
    if (s.players.size < 2) return ack?.({ ok: false, error: 'Need at least 2 players' })
    if (data.difficulty && ['EASY', 'MEDIUM', 'HARD'].includes(data.difficulty)) s.difficulty = data.difficulty
    if (data.timeLimitSec) s.timeLimitSec = Math.min(900, Math.max(60, data.timeLimitSec))
    startPlaying(io, s)
    ack?.({ ok: true })
  })

  socket.on('game:state_request', (_data: unknown, ack?: (res: { ok: boolean; session?: unknown }) => void) => {
    const s = rooms.get(socket.data.gameRoomCode as string)
    if (!s) return ack?.({ ok: false })
    ack?.({ ok: true, session: publicState(s) })
  })

  // ---- Tic-Tac-Toe move ----
  socket.on('game:move', (data: { cell?: number; index?: number }, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const s = rooms.get(socket.data.gameRoomCode as string)
    const userId = socket.data.gameUserId as string
    if (!s || s.status !== 'PLAYING') return ack?.({ ok: false, error: 'No active game' })
    const me = s.players.get(userId)
    if (!me) return ack?.({ ok: false, error: 'You are not in this game' })

    if (s.engine === 'tictactoe') {
      const st = s.state as ReturnType<typeof initTicTacToe>
      if (st.finished || st.roundOver) return ack?.({ ok: false, error: 'Round is over' })
      if (st.turn !== me.seat) return ack?.({ ok: false, error: 'Not your turn' })
      const cell = Number(data.cell)
      if (!Number.isInteger(cell) || cell < 0 || cell > 8 || st.board[cell]) return ack?.({ ok: false, error: 'Invalid move' })
      st.board[cell] = me.seat === 0 ? 'X' : 'O'
      const win = tttWinner(st.board as (string | null)[])
      if (win) {
        st.roundOver = true
        st.line = win.line
        st.roundWinner = me.seat
        st.wins[me.seat] += 1
        io.to(roomCode(s.code)).emit('game:state', publicState(s))
        later(s, 1800, () => {
          const cur = rooms.get(s.code)
          if (!cur || cur.status !== 'PLAYING') return
          const cst = cur.state as ReturnType<typeof initTicTacToe>
          if (cst.wins[me.seat] >= 2) {
            cst.matchWinner = me.seat
            finishSession(io, cur, me.userId, null)
          } else {
            cst.round += 1
            cst.board = Array(9).fill(null)
            cst.roundOver = false
            cst.line = null
            cst.roundWinner = null
            cst.turn = (cst.round - 1) % 2 // alternate first player
            broadcast(cur)
          }
        })
      } else if (st.board.every((c: string | null) => c !== null)) {
        st.roundOver = true
        st.roundWinner = 'draw'
        io.to(roomCode(s.code)).emit('game:state', publicState(s))
        later(s, 1800, () => {
          const cur = rooms.get(s.code)
          if (!cur || cur.status !== 'PLAYING') return
          const cst = cur.state as ReturnType<typeof initTicTacToe>
          cst.round += 1
          cst.board = Array(9).fill(null)
          cst.roundOver = false
          cst.roundWinner = null
          cst.turn = (cst.round - 1) % 2
          broadcast(cur)
        })
      } else {
        st.turn = st.turn === 0 ? 1 : 0
      }
      ack?.({ ok: true })
      broadcast(s)
      return
    }

    if (s.engine === 'memory') {
      const st = s.state as ReturnType<typeof initMemory>
      const index = Number(data.index)
      if (st.finished || st.busy) return ack?.({ ok: false, error: 'Wait a moment' })
      if (st.turn !== me.seat) return ack?.({ ok: false, error: 'Not your turn' })
      if (!Number.isInteger(index) || index < 0 || index >= st.deck.length) return ack?.({ ok: false, error: 'Invalid card' })
      if (st.matched[index] || st.flipped.includes(index)) return ack?.({ ok: false, error: 'Card already revealed' })
      st.flipped.push(index)
      if (st.flipped.length === 2) {
        const [a, b] = st.flipped
        if (st.deck[a] === st.deck[b]) {
          st.matched[a] = true
          st.matched[b] = true
          st.scores[me.seat] += 100
          later(s, 500, () => {
            const cur = rooms.get(s.code)
            if (!cur) return
            const cst = cur.state as ReturnType<typeof initMemory>
            cst.flipped = []
            if (cst.matched.every((m: boolean) => m)) {
              cst.finished = true
              const [s1, s2] = cst.scores
              const winnerSeat = s1 === s2 ? null : s1 > s2 ? 0 : 1
              const winner = winnerSeat === null ? null : [...cur.players.values()].find((x) => x.seat === winnerSeat) ?? null
              finishSession(io, cur, winner?.userId ?? null, null)
            } else broadcast(cur)
          })
        } else {
          st.busy = true
          later(s, 1400, () => {
            const cur = rooms.get(s.code)
            if (!cur || cur.status !== 'PLAYING') return
            const cst = cur.state as ReturnType<typeof initMemory>
            cst.flipped = []
            cst.busy = false
            cst.turn = cst.turn === 0 ? 1 : 0
            broadcast(cur)
          })
        }
      }
      ack?.({ ok: true })
      broadcast(s)
      return
    }

    ack?.({ ok: false, error: 'Unsupported move for this game' })
  })

  // ---- Quick Math answer ----
  socket.on('game:answer', (data: { qSeq?: number; answer?: string }, ack?: (res: { ok: boolean; error?: string; correct?: boolean; points?: number }) => void) => {
    const s = rooms.get(socket.data.gameRoomCode as string)
    const userId = socket.data.gameUserId as string
    if (!s || s.engine !== 'quickmath' || s.status !== 'PLAYING') return ack?.({ ok: false, error: 'No active game' })
    const me = s.players.get(userId)
    const st = s.state as ReturnType<typeof initQuickMath>
    if (!me) return ack?.({ ok: false, error: 'You are not in this game' })
    if (!st.question || st.reveal !== null) return ack?.({ ok: false, error: 'No question is open' })
    if (Number(data.qSeq) !== st.qSeq) return ack?.({ ok: false, error: 'Question has moved on' })
    if (st.answered[userId]) return ack?.({ ok: false, error: 'You already answered this question' })
    const answer = String(data.answer ?? '').trim()
    if (!answer || answer.length > 24) return ack?.({ ok: false, error: 'Invalid answer' })

    const correct = answer === st.question.answer || answer.replace(/\.0+$/, '') === st.question.answer
    let points = 0
    if (correct) {
      const remainMs = Math.max(0, (st.endsAt ?? Date.now()) - Date.now())
      points = 100 + Math.round(50 * (remainMs / 15000))
      me.score += points
    }
    st.answered[userId] = { correct, points }
    ack?.({ ok: true, correct, points })
    broadcast(s)
    // everyone answered → move on early
    const humans = [...s.players.values()].filter((p) => p.connected)
    if (humans.every((p) => st.answered[p.userId])) {
      clearTimers(s)
      st.reveal = st.question.answer
      broadcast(s)
      later(s, 1500, () => nextMathQuestion(io, s))
    }
  })

  // ---- Rematch (host) ----
  socket.on('game:rematch', (_data: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const s = rooms.get(socket.data.gameRoomCode as string)
    const userId = socket.data.gameUserId as string
    const host = s?.players.get(userId)
    if (!s || !host?.isHost) return ack?.({ ok: false, error: 'Only the host can offer a rematch' })
    if (s.status !== 'FINISHED') return ack?.({ ok: false, error: 'Match is not finished' })
    s.status = 'LOBBY'
    for (const p of s.players.values()) { p.ready = false; p.score = 0 }
    ack?.({ ok: true })
    broadcast(s)
  })

  socket.on('game:leave', (_data: unknown, ack?: (res: { ok: boolean }) => void) => {
    const s = rooms.get(socket.data.gameRoomCode as string)
    const userId = socket.data.gameUserId as string
    if (!s) return ack?.({ ok: true })
    const p = s.players.get(userId)
    if (p) {
      if (s.status === 'PLAYING') {
        const others = [...s.players.values()].filter((x) => x.userId !== userId && x.connected)
        finishSession(io, s, others.length === 1 ? others[0].userId : null, null)
      } else {
        s.players.delete(userId)
        if (p.isHost) {
          const next = [...s.players.values()].sort((a, b) => a.seat - b.seat)[0]
          if (next) next.isHost = true
        }
        broadcast(s)
      }
    }
    socket.leave(roomCode(s.code))
    myRooms.delete(s.code)
    ack?.({ ok: true })
  })

  socket.on('disconnect', handleDisconnect)
}

// ---------- Room factory (called from API side via HTTP or direct import) ----------
export function createRoom(opts: {
  code: string; gameId: string; slug: string; engine: Engine; mode: 'DUEL' | 'GROUP'
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'; maxPlayers: number; timeLimitSec: number
}) {
  if (rooms.has(opts.code)) return false
  const s: Session = { ...opts, status: 'LOBBY', players: new Map(), state: {}, lastActivity: Date.now(), timers: [] }
  rooms.set(opts.code, s)
  later(s, 15 * 60 * 1000, () => {
    const cur = rooms.get(opts.code)
    if (cur && cur.status === 'LOBBY' && cur.players.size === 0) destroyRoom(opts.code)
  })
  return true
}

export function roomExists(code: string) {
  return rooms.has(code)
}

export function roomSummaries() {
  return [...rooms.values()].map((s) => ({
    code: s.code, slug: s.slug, mode: s.mode, difficulty: s.difficulty, status: s.status,
    players: roster(s).map((p) => ({ name: p.name, connected: p.connected, ready: p.ready })),
    createdAt: s.lastActivity,
  }))
}
