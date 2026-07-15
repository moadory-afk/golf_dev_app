export const AWARD_CONFIG_KEY = '@gogopar_award_config'

export type AwardSelectionType = 'automatic' | 'manual'
export type AwardItemDef = { id: string; icon: string; label: string; desc: string; detail: string; selectionType?: AwardSelectionType }

// ranked 항목의 다음 순위 체인 (count 보완에 사용)
const RANK_NEXT: Record<string, string> = {
  shin1: 'shin2',
  regular1: 'regular2',
  regular2: 'regular3',
}

/**
 * 선택한 시상 항목만 저장한다.
 * count는 강제 충원 수가 아니라 선택 가능한 최대 수로만 사용한다.
 */
export function fillToCount(items: string[], count: number): string[] {
  return items.slice(0, Math.max(0, count))
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
      { id: 'longDrive', selectionType: 'manual',  icon: '🏌️', label: '롱기스트',  desc: '최장 드라이브', detail: '지정된 롱기스트 홀에서 티샷을 가장 멀리 보낸 플레이어.\n현장에서 결과를 확인해 기록합니다.' },
      { id: 'nearPin', selectionType: 'manual',    icon: '📍', label: '니어리스트', desc: '핀 근접 기록',   detail: '지정된 니어리스트 홀에서 티샷을 핀에 가장 가깝게 붙인 플레이어.\n현장에서 결과를 확인해 기록합니다.' },
    ],
  },
  {
    label: '특별상',
    items: [
      { id: 'last',        icon: '🐢', label: '꼴찌상',     desc: '최고타',          detail: '라운드에서 가장 높은 타수를 기록한 플레이어.\n격려와 유머의 의미로 수여.' },
      { id: 'fighter',     icon: '💪', label: '파이팅상',   desc: '꼴찌인데 버디',    detail: '최하위 타수임에도 버디를 기록한 플레이어.\n꼴찌이지만 포기하지 않는 투지를 기림!' },
      { id: 'effort',      icon: '🎪', label: '감투상',     desc: '파이하 홀 최다',   detail: '파 이하(버디·파)를 가장 많이 기록한 플레이어.\n꾸준하고 성실한 플레이어에게 수여.' },
      { id: 'lucky',       icon: '🍀', label: '럭키상',     desc: '랜덤 추첨',        detail: '참가자 중 랜덤으로 1명을 추첨.\n실력과 무관한 행운의 주인공!' },
      { id: 'bestDresser', selectionType: 'manual', icon: '🌈', label: '베스트드레서', desc: '멋진 골프 패션', detail: '가장 멋진 골프 패션을 선보인 플레이어에게 수여합니다.\n회원 투표 또는 현장 선정으로 결정할 수 있습니다.' },
      { id: 'friendship', selectionType: 'manual',  icon: '🤝', label: '우정상',       desc: '참가상',          detail: '라운드에 함께한 즐거움을 기념하는 참가상입니다.\n참가상으로 생각하면 됩니다.' },
    ],
  },
]

const AWARD_DISPLAY_ORDER = new Map(
  AWARD_CATEGORIES.flatMap((category) => category.items).map((item, index) => [item.id, index]),
)

/**
 * 시상 설정 화면의 카테고리/항목 순서로 선택 항목을 정렬한다.
 * 저장된 선택 순서와 관계없이 홈 히어로 시상계획 등 모든 조회 화면에서
 * 성적 기반 → 홀 기록 → 특별상 순서를 동일하게 유지한다.
 */
export function sortAwardItemIdsByDisplayOrder(items: string[]): string[] {
  return [...items].sort((a, b) => {
    const aOrder = AWARD_DISPLAY_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER
    const bOrder = AWARD_DISPLAY_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })
}

