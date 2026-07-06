# COMPONENT_GUIDE - Home v3.9 Premium Polish

## HomeExperienceScreen

Home 화면은 다음 순서로 구성한다.

1. `PremiumHomeHeroSection`
2. `PremiumGogoCaddieCard`
3. `PremiumRecentStatsSection`

Home에서 제거한 섹션:

- Theme Selector
- Quick Menu
- Upcoming Round Card
- Recent Round List
- Community Card

## PremiumHomeHeroSection

역할:

- 클럽 선택 / 공지 / 프로필 Header 제공
- 예정 라운드 Swipe Hero 제공
- Hero 하단 핵심 정보 4개 제공

Hero 하단 정보:

- 날씨
- 풍속
- 예상 소요시간
- 출발 추천시간

규칙:

- Greeting은 Hero에 넣지 않는다.
- 캐디북 진입은 Concierge 카드에서 제공한다.
- Hero는 라운드 상태와 출발 판단 정보를 보여준다.

## PremiumGogoCaddieCard

역할:

- 사용자를 맞이하는 Greeting 제공
- 예정 라운드 안내 제공
- `AI 캐디북 / 조편성 / Lotto` 진입점 제공
- AI 한줄 코멘트 제공

규칙:

- 교통상황 상세 블록은 넣지 않는다. Hero 하단 정보와 중복되기 때문이다.
- 버튼 텍스트는 말줄임이 심하지 않도록 짧게 유지한다.
- 카드 안에 과도한 중첩 카드를 만들지 않는다.

## PremiumRecentStatsSection

역할:

- 핸디 / 평균 / 최근 / 베스트를 한 줄로 표시한다.

규칙:

- 숫자가 주인공이다.
- 라벨은 HCP / AVG / LAST / BEST 중심으로 짧게 표시한다.
- 4개 카드가 한 줄을 벗어나지 않도록 한다.


# COMPONENT_GUIDE - Home v3.10 Addendum

## PremiumHomeHeroSection
- Home Hero는 compact dashboard 역할을 한다.
- 하단 정보 4개(날씨, 바람, 예상 소요, 출발 추천)는 유지한다.
- 정보 라벨은 한 번만 표시한다.

## PremiumGogoCaddieCard
- Home Concierge는 긴 설명 카드가 아니라 짧은 실행 카드다.
- 구성은 Greeting, 라운드 요약, AI 캐디북/조편성/Lotto, AI 한줄 코멘트로 제한한다.
- 교통상황 상세 블록은 Hero와 중복되므로 넣지 않는다.

## PremiumRecentStatsSection
- Home에서는 4개 기록이 반드시 한 화면에 보여야 한다.
- 라벨은 HCP / AVG / LAST / BEST를 우선 사용한다.
