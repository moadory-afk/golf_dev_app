import { getCaddieBookRawData } from '../api/caddieBookRepository'
import { mapCaddieBookData } from '../mappers/caddieBookMapper'
import type { CaddieBookData, CaddieBookRouteParams } from '../types/caddieBook'

export async function getCaddieBook(params: CaddieBookRouteParams & { userId?: string | null }): Promise<CaddieBookData> {
  const raw = await getCaddieBookRawData({
    userId: params.userId,
    courseId: params.courseId,
    layoutId: params.layoutId,
  })

  return mapCaddieBookData({
    raw,
    courseName: params.courseName,
    layoutName: params.layoutName,
  })
}
