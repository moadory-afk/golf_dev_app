type HomeRecordsListener = (clubId?: string | null) => void

const listeners = new Set<HomeRecordsListener>()
const pendingByClubId = new Map<string, ReturnType<typeof setTimeout>>()

function notifyNow(clubId?: string | null) {
  listeners.forEach((listener) => listener(clubId))
}

export function notifyHomeRecordsChanged(clubId?: string | null) {
  const key = clubId ?? '*'
  const pending = pendingByClubId.get(key)
  if (pending) clearTimeout(pending)
  pendingByClubId.set(key, setTimeout(() => {
    pendingByClubId.delete(key)
    notifyNow(clubId)
  }, 300))
}

export function subscribeHomeRecordsChanged(listener: HomeRecordsListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
