/** Local HTTPS and hosted deployments route signaling through the same secure origin. */
export function getRealtimeUrl(): string {
  // The app gateway forwards Engine.IO HTTP requests and WebSocket upgrades.
  // This keeps tunnel authentication and HTTPS on the same forwarded port.
  if (typeof window !== 'undefined') return window.location.origin
  return '/'
}
