import AsyncStorage from '@react-native-async-storage/async-storage'

export type RoundScheduleStatus = 'planned' | 'recruiting' | 'closed' | 'finished'
export type RoundAttendanceMode = 'member' | 'manager'

export type ScheduledRoundGroupMember = {
  userId: string
  name: string
}

export type ScheduledRoundGroup = {
  id: string
  name: string
  time: string
  frontLayoutId?: string
  frontLayoutName?: string
  backLayoutId?: string
  backLayoutName?: string
  members: ScheduledRoundGroupMember[]
}

export type ScheduledRound = {
  id: string
  date: string
  time: string
  course: string
  note: string
  createdAt: string
  updatedAt: string
  courseId?: string
  courseName?: string
  layoutId?: string
  layoutName?: string
  status: RoundScheduleStatus
  attendanceMode: RoundAttendanceMode
  groups: ScheduledRoundGroup[]
}

type StoredRound = Partial<ScheduledRound> & {
  id: string
  date: string
}

function storageKey(clubId: string) {
  return `@gogopar_round_schedules:${clubId}`
}

function courseLabel(courseName?: string, layoutName?: string, legacyCourse?: string) {
  if (courseName && layoutName) return `${courseName} · ${layoutName}`
  if (courseName) return courseName
  return legacyCourse?.trim() || '미정'
}

function leadTime(groups: ScheduledRoundGroup[], legacyTime?: string) {
  const firstTime = groups
    .map((group) => group.time)
    .find((value) => value && value.trim())
  return firstTime ?? legacyTime?.trim() ?? ''
}

function normalizeGroup(group: Partial<ScheduledRoundGroup> | undefined, index: number): ScheduledRoundGroup | null {
  if (!group?.id) return null
  return {
    id: group.id,
    name: group.name?.trim() || `${index + 1}조`,
    time: group.time?.trim() || '',
    frontLayoutId: group.frontLayoutId,
    frontLayoutName: group.frontLayoutName,
    backLayoutId: group.backLayoutId,
    backLayoutName: group.backLayoutName,
    members: (group.members ?? [])
      .filter((member): member is ScheduledRoundGroupMember => !!member?.userId && !!member?.name)
      .map((member) => ({ userId: member.userId, name: member.name })),
  }
}

function normalizeItem(item: StoredRound): ScheduledRound {
  const groups = (item.groups ?? [])
    .map((group, index) => normalizeGroup(group, index))
    .filter((group): group is ScheduledRoundGroup => !!group)

  return {
    id: item.id,
    date: item.date,
    time: leadTime(groups, item.time),
    course: courseLabel(item.courseName, item.layoutName, item.course),
    note: item.note ?? '',
    createdAt: item.createdAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? new Date().toISOString(),
    courseId: item.courseId,
    courseName: item.courseName,
    layoutId: item.layoutId,
    layoutName: item.layoutName,
    status: item.status ?? 'planned',
    attendanceMode: item.attendanceMode ?? 'member',
    groups,
  }
}

function normalize(items: StoredRound[]) {
  return items
    .map(normalizeItem)
    .sort((a, b) => {
      const left = `${a.date} ${a.time || '99:99'}`
      const right = `${b.date} ${b.time || '99:99'}`
      return left.localeCompare(right)
    })
}

export async function getRoundSchedules(clubId: string): Promise<ScheduledRound[]> {
  const raw = await AsyncStorage.getItem(storageKey(clubId))
  if (!raw) return []
  try {
    return normalize(JSON.parse(raw) as StoredRound[])
  } catch {
    return []
  }
}

export async function saveRoundSchedules(clubId: string, items: ScheduledRound[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(clubId), JSON.stringify(normalize(items)))
}

export async function upsertRoundSchedule(
  clubId: string,
  input: Omit<ScheduledRound, 'id' | 'createdAt' | 'updatedAt' | 'time' | 'course'> & { id?: string | null }
): Promise<ScheduledRound[]> {
  const current = await getRoundSchedules(clubId)
  const now = new Date().toISOString()
  const nextGroups = input.groups.length > 0
    ? input.groups
    : [{ id: `group-${Date.now()}`, name: '1조', time: '', members: [] }]

  const nextItem: ScheduledRound = {
    id: input.id ?? `round-schedule-${Date.now()}`,
    date: input.date,
    courseId: input.courseId,
    courseName: input.courseName,
    layoutId: input.layoutId,
    layoutName: input.layoutName,
    status: input.status,
    attendanceMode: input.attendanceMode,
    groups: nextGroups.map((group, index) => ({
      id: group.id,
      name: group.name?.trim() || `${index + 1}조`,
      time: group.time?.trim() || '',
      frontLayoutId: group.frontLayoutId,
      frontLayoutName: group.frontLayoutName,
      backLayoutId: group.backLayoutId,
      backLayoutName: group.backLayoutName,
      members: group.members ?? [],
    })),
    time: leadTime(nextGroups),
    course: courseLabel(input.courseName, input.layoutName),
    note: input.note,
    createdAt: input.id ? (current.find((item) => item.id === input.id)?.createdAt ?? now) : now,
    updatedAt: now,
  }

  const next = current.some((item) => item.id === nextItem.id)
    ? current.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [...current, nextItem]

  await saveRoundSchedules(clubId, next)
  return normalize(next)
}

export async function deleteRoundSchedule(clubId: string, id: string): Promise<ScheduledRound[]> {
  const current = await getRoundSchedules(clubId)
  const next = current.filter((item) => item.id !== id)
  await saveRoundSchedules(clubId, next)
  return normalize(next)
}

export function getUpcomingRound(items: ScheduledRound[]): ScheduledRound | null {
  if (items.length === 0) return null
  const todayKey = new Date().toISOString().slice(0, 10)
  return items.find((item) => item.date >= todayKey) ?? items[0]
}
