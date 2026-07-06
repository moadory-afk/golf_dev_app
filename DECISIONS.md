# DECISIONS - Home v3.9 Premium Polish

## ADR-013. Home은 기능 메뉴가 아니라 오늘 라운드 Dashboard다

### 결정

Home은 Quick Menu 중심 구조를 버리고, `Hero → Concierge → Stats` 중심으로 정리한다.

### 이유

- Home에서 사용자가 가장 먼저 확인할 것은 다음 라운드 준비 정보다.
- Bottom Navigation이 이미 주요 기능 진입점을 제공하므로 Home에 기능 카드를 반복할 필요가 없다.
- Premium UX는 많은 기능 노출보다 핵심 정보의 빠른 이해가 중요하다.

## ADR-014. 교통/날씨 정보는 Hero에 집중한다

### 결정

날씨, 풍속, 이동시간, 출발 추천시간은 Hero 하단에 유지하고, Concierge 카드에서는 반복하지 않는다.

### 이유

- 같은 정보가 Hero와 Concierge에 반복되면 Home이 복잡해진다.
- Hero는 라운드 상황 판단, Concierge는 안내와 행동 유도 역할로 분리한다.

## ADR-015. 캐디북 진입은 Concierge 카드에서 제공한다

### 결정

AI 캐디북, 조편성, Lotto는 Concierge 카드의 주요 액션으로 제공한다.

### 이유

- 캐디북은 단순한 메뉴가 아니라 오늘 라운드 준비 흐름의 일부다.
- 사용자는 Greeting과 라운드 안내를 본 직후 필요한 행동을 선택하는 것이 자연스럽다.


# DECISIONS - Home v3.10 Addendum

## ADR-016. Home에서는 기록 카드가 반드시 보여야 한다

### 결정
Home은 Hero 중심이지만, 사용자의 기록 4개 카드도 첫 화면에서 보여야 한다.

### 이유
- GogoPar는 오늘의 라운드 준비와 개인 기록 확인이 동시에 필요한 앱이다.
- Concierge가 커져 기록을 가리면 Home의 정보 균형이 무너진다.

### 규칙
- Concierge 카드 높이는 Hero와 Stats 사이 균형을 해치지 않는 범위로 제한한다.
- Bottom Navigation이 Stats를 덮는 상태는 완료로 보지 않는다.
