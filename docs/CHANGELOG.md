# CHANGELOG - Home v3 Hero Weather Summary UI

## Changed
- Home Hero 하단 요약 영역의 날씨 설명 문구를 풍속 표시로 교체했다.
- 온도 아래에 작은 풍속 아이콘과 `m/s` 풍속 텍스트가 표시되도록 수정했다.
- Hero 일정 영역의 폭을 기존 반반 분할보다 넓게 사용할 수 있도록 조정해 Tee Off 시간이 잘리지 않도록 했다.
- 일정 영역의 코스 표시는 라운딩 정보의 `layoutName`을 전반 코스로 사용해 `B 코스 08:10 Tee Off` 형식으로 표시한다.

## Files
- `src/features/home/components/PremiumHomeHeroSection.tsx`
- `docs/CHANGELOG.md`
- `docs/NEXT.md`
- `docs/PROJECT_STATUS.md`

## DB
- 변경 없음

## Verified
- 업로드된 `src.zip`, `docs.zip` 기준으로 실제 파일 수정 완료
- 프로젝트 루트의 `package.json`, `tsconfig.json`이 제공되지 않아 전체 TypeScript 빌드는 실행하지 못함
