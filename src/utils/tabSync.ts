export type TabSyncPayload =
  | { type: 'notes-updated'; timestamp: number }
  | { type: 'route-updated'; timestamp: number }

const TAB_SYNC_CHANNEL = 'ismismcube.tab-sync.v1'

export function broadcastTabSync(payload: TabSyncPayload): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel(TAB_SYNC_CHANNEL)
    channel.postMessage(payload)
    channel.close()
  } catch {
    // Ignore channel failures in isolated or mock contexts.
  }
}

export function subscribeTabSync(handler: (payload: TabSyncPayload) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  try {
    const channel = new BroadcastChannel(TAB_SYNC_CHANNEL)
    const onMessage = (event: MessageEvent<unknown>) => {
      const data = event.data as Partial<TabSyncPayload> | null
      if (!data || typeof data !== 'object') return
      if (data.type === 'notes-updated' || data.type === 'route-updated') {
        handler({ type: data.type, timestamp: Number(data.timestamp) || Date.now() })
      }
    }
    channel.addEventListener('message', onMessage)
    return () => {
      channel.removeEventListener('message', onMessage)
      channel.close()
    }
  } catch {
    return () => {}
  }
}

export async function withWebLock<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined
  if (!locks || typeof locks.request !== 'function') {
    return await fn()
  }
  return await locks.request(name, async () => await fn())
}
