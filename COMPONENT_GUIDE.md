# COMPONENT_GUIDE

## Base Components

- GPButton
- GPCard
- GPSection
- GPBadge
- GPChip
- GPAvatar

## Home Components

- PremiumHomeHeroSection
  - Home Experience v1.1에서 추가
  - 이미지 기반 Hero Header
  - 인사, 클럽 선택, 알림, 코스명, 보조 위치/코스 정보, 날씨, D-Day, Tee Off, 인디케이터 포함
  - 색상은 `useSkin().palette`와 `colorLayers` 토큰 사용

- PremiumGogoCaddieCard
  - Home Experience v1.2에서 추가
  - Hero 아래에 배치되는 대형 AI Caddie 안내 카드
  - 예정 라운드 유무에 따라 코스/티오프/평균 스코어 기반 메시지 표시
  - GogoPar 로고 이미지를 임시 캐디 Visual로 사용
  - 색상, Shadow, Radius, Spacing은 Skin Palette와 Design Token만 사용

- PremiumRecentStatsSection
  - Home Experience v1.3에서 추가
  - 핸디캡, 평균 스코어, 최근 라운드, 베스트 스코어를 2x2 Premium Mini Card로 표시
  - 각 카드에 아이콘 Badge, 핵심 숫자, 보조 설명, 미니 트렌드 라인 포함
  - 기록이 없는 상태에서도 안전한 Empty State 표시
  - 색상, Shadow, Radius, Spacing은 Skin Palette와 Design Token만 사용


- PremiumUpcomingRoundCard
  - Home Experience v1.4에서 추가
  - 예정 라운드를 대형 Premium Ticket Card로 표시
  - 코스 이미지, 상태 Badge, 골프장명, 코스명, 날짜, Tee Off, 인원, 날씨 정보 포함
  - 우측 액션 영역에 코스맵, 조편성, Lotto 6/18 버튼 구조 포함
  - 예정 라운드가 없을 때 라운드 일정 생성 CTA Empty State 제공
  - 색상, Shadow, Radius, Spacing은 Skin Palette와 Design Token만 사용

## Component Rule

새 Home 컴포넌트는 Screen 내부에 직접 구현하지 않고 `src/features/home/components`에 재사용 가능한 단위로 둔다.
