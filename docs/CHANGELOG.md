# CHANGELOG - Home Hero Full Bleed v3.0 Phase 2

## Changed
- Home Hero가 iPhone 상단 상태바 영역부터 좌우 여백 없이 전체 폭으로 표시되도록 조정했다.
- Home ScrollView의 기본 좌우 패딩을 제거하고, Hero 외 섹션은 LayoutRenderer에서 기존 20px 좌우 여백을 유지하도록 분리했다.
- Hero 내부 상단 버튼은 Safe Area 값을 반영해 상태바와 겹치지 않도록 배치했다.
- Hero 카드의 외곽 라운드 처리를 제거해 상단/좌우가 화면에 밀착되도록 변경했다.

## Files
- `src/screens/HomeExperienceScreen.tsx`
- `src/features/home/components/PremiumHomeHeroSection.tsx`
- `src/features/home/layout/HomeLayoutRenderer.tsx`
- `docs/CHANGELOG.md`
- `docs/NEXT.md`
- `docs/PROJECT_STATUS.md`

## DB
- 변경 없음

## Verified
- 업로드된 `src.zip`, `docs.zip` 기준으로 실제 파일 수정 완료
- 프로젝트 루트의 `package.json`, `tsconfig.json`이 제공되지 않아 전체 TypeScript 검증은 실행하지 못함
