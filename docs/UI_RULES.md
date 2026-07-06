# UI_RULES

Rule 1

Screen

↓

Section

↓

Card

↓

Widget

Rule 2

Section 안에는 Section 금지

Rule 3

Card 안에는 Card 금지

Rule 4

Spacing는 Design Token만 사용

Rule 5

색상 하드코딩 금지

Rule 6

Hero처럼 이미지 위에 올라가는 Overlay / Glass / Muted Text 색상은 `src/design/tokens.ts`의 `colorLayers`를 사용한다.

Rule 7

Screen은 Supabase를 직접 호출하지 않는다.

Screen

↓

Hook

↓

Service

↓

Repository

순서로 데이터에 접근한다.

Rule 8

AI Caddie 계산 로직은 UI 컴포넌트에 작성하지 않는다.

UI

↓

Hook

↓

Service

↓

Engine

순서로 호출한다.

Rule 9

AI Engine은 순수 함수 중심으로 유지한다.

DB 조회, Navigation, 화면 상태, Toast, Alert는 Engine에 넣지 않는다.

Rule 10

AI Caddie Data Binding은 Repository와 Mapper에서 처리한다.

DB Row

↓

Mapper

↓

Engine Input

↓

Preview Model

순서로 화면에 전달한다.
