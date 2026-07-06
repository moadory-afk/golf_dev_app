import { supabase } from '../../../lib/supabase'
import type { CaddieBindingRawData, CaddieDistanceProfileRow, CaddieHoleGuideRow, CaddieUserPreferencesRow } from '../types/caddieData'

async function maybeSingle<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T | null> {
  const { data, error } = await query
  if (error) throw error
  return (data ?? null) as T | null
}

export async function getCaddieBindingRawData(params: {
  userId: string
  courseId: string
  layoutId: string
  holeNo?: number
}): Promise<CaddieBindingRawData> {
  const holeNo = params.holeNo ?? 1

  const [distanceProfile, preferences, holeGuide] = await Promise.all([
    maybeSingle<CaddieDistanceProfileRow>(
      supabase
        .from('user_distance_profiles')
        .select('user_id, driver_m, wood3_m, wood5_m, hybrid4_m, hybrid5_m, iron5_m, iron6_m, iron7_m, iron8_m, iron9_m, pw_m, aw_m, sw_m, putter_note')
        .eq('user_id', params.userId)
        .maybeSingle(),
    ),
    maybeSingle<CaddieUserPreferencesRow>(
      supabase
        .from('user_preferences')
        .select('user_id, default_tee, distance_unit, show_ai_caddie')
        .eq('user_id', params.userId)
        .maybeSingle(),
    ),
    maybeSingle<CaddieHoleGuideRow>(
      supabase
        .from('course_hole_guides')
        .select('id, golf_course_id, layout_id, hole_no, par, title, summary, strategy, caution, blue_tee_m, white_tee_m, red_tee_m, tee_strategy, shot_plan, ob_info, bunker_info, hazard_info, green_info, course_features, difficulty_tags, difficulty_factors')
        .eq('golf_course_id', params.courseId)
        .eq('layout_id', params.layoutId)
        .eq('hole_no', holeNo)
        .maybeSingle(),
    ),
  ])

  return { distanceProfile, preferences, holeGuide }
}
