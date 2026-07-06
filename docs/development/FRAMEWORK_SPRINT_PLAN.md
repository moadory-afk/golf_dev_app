# GogoPar Framework Sprint Plan

## 목표

GogoPar Framework v1.0 구축.

이 Sprint가 끝나면 Home, Round, Club, Record 화면을 공통 UI Kit로 조립할 수 있어야 한다.

---

## Day 1. Theme System
- colors
- spacing
- radius
- typography
- shadows
- motion

## Day 2. Base UI Kit
- GPButton
- GPCard
- GPText
- GPBadge
- GPChip
- GPAvatar

## Day 3. Golf UI Kit
- GPHero
- GogoCard
- GPStatCard
- GPRoundTicket
- GPWeatherChip
- GPTeeTimeChip

## Day 4. Home V2 Refactor
- HomeScreenV2를 UI Kit 기반으로 재구성
- useHomeViewModel 도입

## Day 5. Test & Polish
- 예정 라운드 있음
- 예정 라운드 없음
- 날씨 API 오류
- 이미지 없음
- 작은 화면 대응

---

## 완료 기준

- Home V2가 UI Kit만으로 조립된다.
- 기존 HomeScreen은 보존된다.
- Theme Token 없이 직접 색상/여백을 쓰지 않는다.
- Supabase 직접 호출이 Screen에 남아 있지 않다.
