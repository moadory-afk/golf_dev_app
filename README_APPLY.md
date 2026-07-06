# GogoPar Framework Sprint v1.0 - Sprint 3 Design Token System

## 적용 방법
프로젝트 루트에서 이 ZIP을 압축 해제하면 아래 파일만 추가/교체됩니다.

- `src/design/tokens.ts` 신규 추가
- `src/design/index.tsx` 교체

기존 `src/screens`, `src/components`, `src/lib` 등 다른 파일은 삭제되지 않습니다.

## 이번 Sprint 내용
- 색상, 간격, Radius, Typography, Shadow를 `tokens.ts`로 분리
- `useTheme()` 추가
- 기존 `useSkin()` 기반 팔레트를 Design Token으로 확장
- 기존 `GPCard`, `GPSection`, `GPButton`, `GPStatCard`, `GPMascotHero`, `GPRoundTicket`를 Theme Token 기반으로 정리
- 신규 `GPBadge` 추가

## 적용 후 확인
```bash
npm run start
```

현재 프로젝트에는 기존 타입 오류가 일부 남아 있어 `npx tsc --noEmit`은 전체 프로젝트 기준으로 실패할 수 있습니다.
이번 ZIP은 Design System 파일만 변경합니다.
