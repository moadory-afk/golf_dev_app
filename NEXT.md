# NEXT - Home Experience Sprint v1.8

다음 작업은 `Skeleton Loading` 제품화입니다.

## Priority

1. Home 데이터 로딩 중 카드 레이아웃이 흔들리지 않도록 Skeleton UI 적용
2. Hero / Upcoming Round / Stats 중심으로 우선 적용
3. 실제 데이터 로직 변경 금지
4. 색상/간격은 Skin Palette와 Design Token만 사용

## Acceptance Criteria

- Home 로딩 상태에서 Premium Skeleton 표시
- 기존 ActivityIndicator 의존 최소화
- 화면 높이와 카드 리듬 유지
- `npx tsc --noEmit` 통과
- 작업 후 CHANGELOG.md, NEXT.md, PROJECT_STATUS.md, COMPONENT_GUIDE.md 업데이트
