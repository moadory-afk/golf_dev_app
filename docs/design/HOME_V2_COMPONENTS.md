# Home V2 Component 명세

## 컴포넌트

-   HomeScreenV2
-   GPHomeTopBar
-   GPHeroSection
-   GogoCaddieCard
-   GPStatCard
-   GPRoundTicket
-   GPQuickActionGrid
-   GPBottomNavigation

## 원칙

-   HomeScreenV2만 데이터 조회
-   하위 컴포넌트는 UI 전용
-   모든 컴포넌트는 Props 기반
-   기존 HomeScreen 유지

## PremiumHomeHeroSection

Home Experience Sprint v1.1에서 추가된 상단 Hero 컴포넌트.

구성:
- Greeting
- Active Club Pill
- Notification Button
- Course Hero Image
- Course Name
- Course Meta Text
- Weather / D-Day / Tee Off
- Slide Indicator

구현 위치:
- `src/features/home/components/PremiumHomeHeroSection.tsx`
