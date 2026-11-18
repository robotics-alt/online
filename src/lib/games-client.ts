'use client'

/**
 * Client helpers for the Brain Games module: socket connection to the
 * realtime game service (server-authoritative multiplayer) + solo result
 * submission.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getRealtimeUrl } from '@/lib/realtime-url'
import { api } from '@/lib/store'

export interface RosterPlayer {
  userId: string
  name: string
  avatarUrl: string | null
  seat: number
  ready: boolean
  connected: boolean
  isHost: boolean
  score: number
}

export interface GameSession {
  code: string
  slug: string
  engine: string
  mode: string
  difficulty: string
  status: 'LOBBY' | 'PLAYING' | 'FINISHED'
  maxPlayers: number
  players: RosterPlayer[]
  state: Record<string, unknown>
}

/** Opens (and cleans up) a socket connection to the realtime game service. */
export function useGameSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    const s = io(getRealtimeUrl(), {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1200,
      timeout: 10000,
    })
    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- socket is an external system
    setSocket(s)
    return () => { s.close(); setSocket(null) }
  }, [])
  return { socket, connected }
}

/** Fetches a short-lived signed token for the game service. */
export async function fetchGameToken(): Promise<string> {
  const res = await api<{ token: string }>('/api/games', { method: 'POST', json: { action: 'token' } })
  return res.token
}

export interface UseGameRoomResult {
  session: GameSession | null
  error: string | null
  ready: (v: boolean) => void
  start: (opts?: { difficulty?: string; timeLimitSec?: number }) => void
  move: (payload: { cell?: number; index?: number }) => void
  answer: (qSeq: number, answer: string) => void
  rematch: () => void
  leave: () => void
}

/**
 * Joins a game room and exposes imperative actions + live session state.
 * All game state comes from the server; this hook never computes scores.
 */
export function useGameRoom(socket: Socket | null, roomCode: string | null): UseGameRoomResult {
  const [session, setSession] = useState<GameSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const joined = useRef(false)

  const join = useCallback(async () => {
    if (!socket || !roomCode || joined.current) return
    joined.current = true
    try {
      const token = await fetchGameToken()
      socket.emit('game:join', { token, roomCode }, (res: { ok: boolean; error?: string; session?: GameSession }) => {
        if (res.ok && res.session) setSession(res.session)
        else setError(res.error ?? 'Could not join the game room')
      })
    } catch {
      setError('Could not authenticate with the game service')
    }
  }, [socket, roomCode])

  useEffect(() => {
    joined.current = false
    const t = setTimeout(() => { void join() }, 0)
    return () => clearTimeout(t)
  }, [socket, roomCode, join])

  useEffect(() => {
    if (!socket) return
    const onState = (s: GameSession) => setSession(s)
    const onStarted = (s: GameSession) => setSession(s)
    socket.on('game:state', onState)
    socket.on('game:started', onStarted)
    return () => {
      socket.off('game:state', onState)
      socket.off('game:started', onStarted)
    }
  }, [socket])

  const ready = useCallback((v: boolean) => socket?.emit('game:ready', { ready: v }), [socket])
  const start = useCallback((opts?: { difficulty?: string; timeLimitSec?: number }) =>
    socket?.emit('game:start', opts ?? {}, () => {}), [socket])
  const move = useCallback((payload: { cell?: number; index?: number }) =>
    socket?.emit('game:move', payload, () => {}), [socket])
  const answer = useCallback((qSeq: number, answer: string) =>
    socket?.emit('game:answer', { qSeq, answer }, () => {}), [socket])
  const rematch = useCallback(() => socket?.emit('game:rematch', {}, () => {}), [socket])
  const leave = useCallback(() => socket?.emit('game:leave', {}, () => {}), [socket])

  return { session, error, ready, start, move, answer, rematch, leave }
}

/** Submits a solo result with server-side plausibility validation. */
export async function submitSoloResult(payload: {
  gameSlug: string; difficulty: string; score: number; durationSec: number; stats?: Record<string, unknown>
}): Promise<{ score: number; earned: string[] }> {
  return api('/api/games', { method: 'POST', json: { action: 'solo-result', ...payload } })
}
