/**
 * Cleanup duplicate profiles.
 *
 * 이 스크립트는 `profiles` 테이블에서 동일한 `id` 를 가진 행들을 찾아,
 * 각 행이 `rounds` 테이블에 참조되지 않은 경우(= 사용 기록이 없으면)
 * 중복된 행 중 하나씩 삭제합니다.
 *
 * 실행 방법:
 *   npx ts-node src/lib/cleanupDuplicateProfiles.ts
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// NOTE
// 기존에 `import supabase from './supabase'` 로 작성했을 때
// ts-node 와 ESM 호환 문제로 오류가 발생했습니다.
// CommonJS 방식인 `require` 로 교체하고, 타입을 `any` 로 간주해
// 제네릭 사용을 피했습니다.
const { supabase } = require('./supabase');

// ---------------------------------------------------------------------------
// 타입 정의 ---------------------------------------------------------------

interface ProfileIdRow {
  id: string;
}

interface ProfileRow {
  id: string;
  created_at: string; // Supabase 기본 타임스탬프 형식
}

// ---------------------------------------------------------------------------
// Helper: duplicate된 profile id 목록 조회
async function getDuplicateProfileIds(): Promise<string[]> {
  // `supabase` 를 any 로 취급하면 제네릭 사용이 필요 없으므로 TS2347 오류가 사라집니다.
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('id')
    .group('id')
    .having('count(id)', '>', 1);

  if (error) {
    console.error('❌ duplicate id 조회 실패:', error);
    throw error;
  }

  // data 가 null 일 경우를 대비해 빈 배열을 반환합니다.
  const rows = (data ?? []) as ProfileIdRow[];
  // 콜백 매개변수에 타입을 명시해 TS7006 오류를 해결합니다.
  return rows.map((row: ProfileIdRow) => row.id);
}

// ---------------------------------------------------------------------------
// Helper: 특정 profile 이 라운드에 사용되는가?
async function hasRounds(profileId: string): Promise<boolean> {
  const { count, error } = await (supabase as any)
    .from('rounds')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId);

  if (error) {
    console.error(`❌ rounds 조회 실패 (profile_id=${profileId}):`, error);
    throw error;
  }

  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Main cleanup 로직
async function cleanup() {
  console.log('🔎 중복 profile ID 탐색 중...');
  const duplicateIds = await getDuplicateProfileIds();

  if (duplicateIds.length === 0) {
    console.log('✅ 중복된 profile이 없습니다.');
    return;
  }

  console.log(`⚠️ 중복된 ID 발견: ${duplicateIds.join(', ')}`);

  for (const dupId of duplicateIds) {
    // 해당 id 를 가진 모든 레코드 가져오기
    const { data: rows, error: fetchErr } = await (supabase as any)
      .from('profiles')
      .select('id, created_at')
      .eq('id', dupId)
      .order('created_at', { ascending: true });

    if (fetchErr) {
      console.error(`❌ profile 조회 실패 (id=${dupId}):`, fetchErr);
      continue;
    }

    // rows 가 null 일 경우를 방지
    const profileRows: ProfileRow[] = (rows ?? []) as ProfileRow[];

    if (profileRows.length < 2) {
      // 중복이 아닌 경우(예외 방어)
      continue;
    }

    // 가장 오래된 레코드(첫 번째)를 남기고, 나머지를 검사
    const [keep, ...candidates] = profileRows;

    for (const candidate of candidates) {
      const used = await hasRounds(candidate.id);
      if (used) {
        console.log(
          `🔐 라운드와 연결된 profile이므로 유지: id=${candidate.id}`
        );
        continue; // 라운드와 연결돼 있으면 삭제하지 않음
      }

      // 실제 삭제
      const { error: delErr } = await (supabase as any)
        .from('profiles')
        .delete()
        .eq('id', candidate.id);

      if (delErr) {
        console.error(
          `❌ profile 삭제 실패 (id=${candidate.id}):`,
          delErr
        );
      } else {
        console.log(
          `🗑️ 중복 profile 삭제 완료: id=${candidate.id} (keep id=${keep.id})`
        );
      }
    }
  }

  console.log('✅ Cleanup 작업이 끝났습니다.');
}

// ---------------------------------------------------------------------------
// 실행 진입점
cleanup()
  .catch((e) => {
    console.error('❌ Cleanup 중 예외 발생:', e);
    process.exit(1);
  })
  .finally(() => {
    // Supabase 클라이언트는 자동으로 연결 해제됩니다.
    process.exit(0);
  });