export const AWARD_CONFIG_KEY = '@gogopar_award_config'

export type AwardItemDef = { id: string; icon: string; label: string; desc: string; detail: string }

// ranked 항목의 다음 순위 체인 (count 보완에 사용)
const RANK_NEXT: Record<string, string> = {
  shin1: 'shin2',
  regular1: 'regular2',
  regular2: 'regular3',
}

/**
 * items를 count 수만큼 자동 보완하여 반환.
 * shin1→shin2, regular1→regular2→regular3 순으로 하위 순위를 자동 추가.
 * items.length > count 이면 앞에서 count개만 반환.
 */
export function fillToCount(items: string[], count: number): string[] {
  const res = [...items]
  let changed = true
  while (changed && res.length < count) {
    changed = false
    for (let i = 0; i < res.length && res.length < count; i++) {
      const next = RANK_NEXT[res[i]]
      if (next && !res.includes(next)) {
        res.splice(i + 1, 0, next)
        changed = true
        i++
      }
    }
  }
  return res.slice(0, count)
}

export const AWARD_CATEGORIES: { label: string; items: AwardItemDef[] }[] = [
  {
    label: '성적 기반',
    items: [
      { id: 'medal',    icon: '🏆', label: '메달리스트',    desc: '최저타',       detail: '라운드에서 가장 낮은 타수를 기록한 플레이어.\n핸디 없이 순수 타수 기준.' },
      { id: 'regular1', icon: '🥇', label: '정규 1위',     desc: '핸디 Net 1위', detail: '핸디캡을 적용한 Net 타수 기준 1위.\n클럽 설정의 기준 경기수로 핸디를 산출.' },
      { id: 'regular2', icon: '🥈', label: '정규 2위',     desc: '핸디 Net 2위', detail: '핸디캡을 적용한 Net 타수 기준 2위.' },
      { id: 'regular3', icon: '🥉', label: '정규 3위',     desc: '핸디 Net 3위', detail: '핸디캡을 적용한 Net 타수 기준 3위.' },
      { id: 'shin1',    icon: '🎯', label: '신페리오 1위',  desc: '신페리오 기준', detail: '신페리오 방식 1위.\n선정된 12개 홀은 실제 타수, 나머지 6개 홀은 파로 대체하여 합산.' },
      { id: 'shin2',    icon: '🎯', label: '신페리오 2위',  desc: '신페리오 기준', detail: '신페리오 방식 2위.\n선정 홀 12개 실타 + 나머지 파 합산 점수 기준.' },
    ],
  },
  {
    label: '홀 기록',
    items: [
      { id: 'birdieKing', icon: '🐦', label: '버디왕',   desc: '최다 버디', detail: '라운드에서 버디(파-1)를 가장 많이 기록한 플레이어.\n버디가 0개이면 수여하지 않음.' },
      { id: 'eagleKing',  icon: '🦅', label: '이글왕',   desc: '이글 달성자', detail: '이글(파-2) 이하를 기록한 플레이어.\n해당 라운드에 이글 달성자가 없으면 수여하지 않음.' },
      { id: 'parKing',    icon: '⛳', label: '파왕',     desc: '최다 파', detail: '파(기준타)를 가장 많이 기록한 플레이어.\n안정적이고 꾸준한 플레이의 상징!' },
      { id: 'bogeyKing',  icon: '🎳', label: '보기왕',   desc: '최다 보기', detail: '보기(파+1)를 가장 많이 기록한 플레이어.\n유머 시상 🙂 격려의 의미로 수여.' },
      { id: 'doublePlus', icon: '💥', label: '더블+왕',  desc: '더블이상 최다', detail: '더블보기(파+2) 이상을 가장 많이 기록한 플레이어.\n유머 시상 😅 다음엔 더 잘할 수 있어!' },
    ],
  },
  {
    label: '특별상 / 유머',
    items: [
      { id: 'last',        icon: '🐢', label: '꼴찌상',     desc: '최고타',          detail: '라운드에서 가장 높은 타수를 기록한 플레이어.\n격려와 유머의 의미로 수여.' },
      { id: 'fighter',     icon: '💪', label: '파이팅상',   desc: '꼴찌인데 버디',    detail: '최하위 타수임에도 버디를 기록한 플레이어.\n꼴찌이지만 포기하지 않는 투지를 기림!' },
      { id: 'effort',      icon: '🎪', label: '감투상',     desc: '파이하 홀 최다',   detail: '파 이하(버디·파)를 가장 많이 기록한 플레이어.\n꾸준하고 성실한 플레이어에게 수여.' },
      { id: 'lucky',       icon: '🍀', label: '럭키상',     desc: '랜덤 추첨',        detail: '참가자 중 랜덤으로 1명을 추첨.\n실력과 무관한 행운의 주인공!' },
      { id: 'longDrive',   icon: '🏌️', label: '장타왕',     desc: '롱기스트 (현장)',   detail: '롱기스트 지정 홀에서 가장 멀리 보낸 플레이어.\n현장에서 직접 확인 후 기록.' },
      { id: 'nearPin',     icon: '📍', label: '정확도왕',   desc: '니어리스트 (현장)', detail: '니어리스트 지정 홀에서 핀에 가장 가깝게 붙인 플레이어.\n현장에서 직접 확인 후 기록.' },
      { id: 'bestDresser', icon: '🌈', label: '베스트드레서', desc: '랜덤 추첨',        detail: '가장 멋진 골프 패션을 선보인 플레이어.\n투표 또는 랜덤 추첨으로 결정.' },
    ],
  },
]
