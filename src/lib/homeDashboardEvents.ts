type HomeDashboardListener = (clubId?: string | null) => void

const listeners = new Set<HomeDashboardListener>()

export function notifyHomeDashboardChanged(clubId?: string | null) {
  listeners.forEach((listener) => listener(clubId))
}

export function subscribeHomeDashboardChanged(listener: HomeDashboardListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
