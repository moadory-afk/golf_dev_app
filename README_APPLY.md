# GogoPar Home Experience Sprint v1.0 적용 안내

## 포함 파일

- `src/screens/HomeExperienceScreen.tsx`
- `src/navigation/index.tsx`

## 적용 방법

프로젝트 루트에서 이 ZIP을 압축 해제하면 같은 경로의 파일만 교체/추가됩니다.
기존 `src/screens/HomeScreen.tsx`는 삭제하지 않습니다. 새 홈 화면은 `HomeExperienceScreen.tsx`로 추가되고, 네비게이션에서 홈 탭만 새 화면을 보도록 연결했습니다.

## 실행

```bash
npm run start
```

## 확인 항목

- 홈 탭이 새 Home Experience 화면으로 열리는지 확인
- 상단 슬로건: `골프의 모든 순간을 GogoPar가 함께합니다.` 표시
- Quick Menu 6개 카드 표시
- 테마 선택 칩 정상 동작
- 예정 라운드 또는 빈 상태 카드 표시
- 최근 라운드 기록 표시

## 주의

`npm run typecheck` 스크립트는 현재 package.json에 없습니다. `npx tsc --noEmit`은 기존 프로젝트에 남아 있는 타입 오류까지 함께 검사하므로 이번 Sprint와 무관한 오류가 표시될 수 있습니다.
