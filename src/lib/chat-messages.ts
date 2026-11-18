/** Merge API delivery and socket echoes by stable message ID. */
export function mergeMessages<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  const messages = new Map(previous.map((message) => [message.id, message]))
  for (const message of incoming) messages.set(message.id, message)
  return [...messages.values()]
}
