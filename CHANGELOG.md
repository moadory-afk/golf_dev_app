# CHANGELOG

## Framework Sprint v1.0 - Sprint 5-1 UI Component Library

### Added
- `src/components/ui` 폴더 추가
- `GPText` 공통 텍스트 컴포넌트 추가
- `GPCard` 공통 카드 컴포넌트 추가
- `GPButton` 공통 버튼 컴포넌트 추가
- `GPSection` 섹션 레이아웃 컴포넌트 추가
- `GPBadge`, `GPChip`, `GPIconButton`, `GPAvatar`, `GPDivider` 추가
- `src/components/ui/index.ts` 배럴 export 추가

### Notes
- 이번 Sprint는 기존 화면을 직접 변경하지 않고, 다음 Home 리팩터링을 위한 UI 기반만 추가한다.
- 기존 `src/design/index.tsx`에 있던 컴포넌트는 유지한다.
- 새 화면/리팩터링 화면은 앞으로 `src/components/ui`를 우선 사용한다.
