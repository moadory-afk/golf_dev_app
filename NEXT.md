# NEXT

## Sprint 5-2

다음 작업은 Home 화면을 새 UI Component Library 기준으로 점진 리팩터링한다.

### Target files
- `src/screens/HomeScreen.tsx`
- `src/components/home/GPHeroSection.tsx`
- `src/components/AppHeader.tsx`
- `src/components/AppTabBar.tsx`

### Goals
- Home의 카드/버튼/섹션을 `GPCard`, `GPButton`, `GPSection`, `GPText` 기반으로 정리
- 기존 기능 로직은 유지
- 하드코딩 스타일은 줄이고 `useSkin()` 기반으로 통일
