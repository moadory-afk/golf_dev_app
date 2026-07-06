// cleanupDuplicateProfiles.js
/**
 * cleanupDuplicateProfiles.js
 *
 * 중복된 `profiles.id` 를 찾아 라운드와 연결되지 않은
 * 행을 삭제하는 스크립트.
 *
 * 실행 방법 (프로젝트 루트에서):
 *   node src/lib/cleanupDuplicateProfiles.js
 */

const { supabase } = require('./supabase');

// --------------------------------------------------------
// Helper: duplicate된 profile id 목록 조회
async function getDuplicateProfileIds() {
  // Supabase JS SDK does not support .group(); we fetch all ids and group in JS.
  const { data, error } = await supabase
    .from('profiles')
    .select('id');

  if (error) {
    console.error('❌ duplicate id 조회 실패:', error);
    throw error;
  }

  const rows = data ?? [];
  const countMap = {};
  rows.forEach(row => {
    const id = row.id;
    countMap[id] = (countMap[id] || 0) + 1;
  });

  // ids whose count > 1 are duplicates
  return Object.keys(countMap).filter(id => countMap[id] > 1);
}

// Helper: 특정 profile 이 라운드에 사용되는가?
async function hasRounds(profileId) {
  const { count, error } = await supabase
    .from('rounds')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId);

  if (error) {
    console.error(`❌ rounds 조회 실패 (profile_id=${profileId}):`, error);
    throw error;
  }

  return (count ?? 0) > 0;
}

// --------------------------------------------------------
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
    const { data: rows, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, created_at')
      .eq('id', dupId)
      .order('created_at', { ascending: true });

    if (fetchErr) {
      console.error(`❌ profile 조회 실패 (id=${dupId}):`, fetchErr);
      continue;
    }

    const profileRows = rows ?? [];

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
      const { error: delErr } = await supabase
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

// --------------------------------------------------------
cleanup()
  .catch(e => {
    console.error('❌ Cleanup 중 예외 발생:', e);
    process.exit(1);
  });
