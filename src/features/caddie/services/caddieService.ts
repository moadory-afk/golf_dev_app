import { getCaddieBindingRawData } from '../api/caddieRepository'
import { mapHomeAICaddiePreview } from '../mappers/caddieMapper'
import type { HomeAICaddiePreview, HomeAICaddiePreviewParams } from '../types/caddieData'

export async function getHomeAICaddiePreview(params: HomeAICaddiePreviewParams): Promise<HomeAICaddiePreview | null> {
  if (!params.userId || !params.courseId || !params.layoutId) return null

  try {
    const raw = await getCaddieBindingRawData({
      userId: params.userId,
      courseId: params.courseId,
      layoutId: params.layoutId,
      holeNo: params.holeNo ?? 1,
    })

    return mapHomeAICaddiePreview({
      raw,
      courseName: params.courseName,
      teeTime: params.teeTime,
      dday: params.dday,
      fallbackAverageScore: params.fallbackAverageScore,
    })
  } catch {
    return null
  }
}
