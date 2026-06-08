/**
 * OCR 인식 이름 ↔ 클럽맴버 이름 퍼지 매칭
 *
 * 우선순위:
 *  1. 완전 일치         (score 100)  "김성혁" == "김성혁"
 *  2. 포함 관계         (score 80)   "성혁" ⊂ "김성혁"
 *  3. 마지막 글자 포함  (score 60)   "혁" ∈ "성혁"
 *  4. 2글자 이상 겹침   (score 40+)  "성혁" vs "이성역" → 1글자: 부족
 *
 * usedIndices: 이미 다른 맴버에게 매칭된 OCR 인덱스 (중복 방지)
 */
export function findBestOcrMatch(
  memberName: string,
  ocrNames: string[],
  usedIndices: Set<number>,
): number {
  const norm = (s: string) => s.replace(/\s/g, '').toLowerCase()
  const m = norm(memberName)
  if (!m) return -1

  let bestIdx = -1
  let bestScore = 0

  ocrNames.forEach((ocrName, idx) => {
    if (usedIndices.has(idx)) return
    const o = norm(ocrName)
    if (!o) return

    let score = 0
    if (o === m) {
      score = 100                                         // 완전 일치
    } else if (m.includes(o) || o.includes(m)) {
      score = 80                                          // 포함 관계
    } else if (o.includes(m.slice(-1))) {
      score = 60                                          // 마지막 글자 포함
    } else {
      // 글자 겹침 점수 (양방향)
      const overlap = [...o].filter((c) => m.includes(c)).length
      score = overlap >= 2 ? overlap * 20 : 0
    }

    if (score > bestScore) {
      bestScore = score
      bestIdx = idx
    }
  })

  return bestScore >= 40 ? bestIdx : -1
}
