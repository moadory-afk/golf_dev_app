import { supabase } from './supabase'

export type PersonalRecordGoal = {
  userId: string
  targetScore: number
  updatedAt: string | null
}

export async function getPersonalRecordGoal(userId: string): Promise<PersonalRecordGoal | null> {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) return null

  const { data, error } = await supabase
    .from('personal_record_goals')
    .select('user_id, target_score, updated_at')
    .eq('user_id', normalizedUserId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    userId: data.user_id,
    targetScore: Number(data.target_score),
    updatedAt: data.updated_at ?? null,
  }
}

export async function savePersonalRecordGoal(userId: string, targetScore: number): Promise<void> {
  const normalizedUserId = userId.trim()
  const normalizedTargetScore = Math.round(targetScore)

  if (!normalizedUserId) throw new Error('로그인 사용자 정보를 확인할 수 없습니다.')
  if (!Number.isFinite(normalizedTargetScore) || normalizedTargetScore < 1 || normalizedTargetScore > 300) {
    throw new Error('목표 타수는 1~300 사이로 입력해 주세요.')
  }

  const { error } = await supabase
    .from('personal_record_goals')
    .upsert(
      {
        user_id: normalizedUserId,
        target_score: normalizedTargetScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) throw error
}
