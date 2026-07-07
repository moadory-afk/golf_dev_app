# GogoPar Project Status

## Current Version
Home Redesign v3.0 Phase 2

## Current Sprint
Home Redesign v3.0

## Progress

✅ Theme System
✅ Skin System
✅ Design Token
✅ Architecture
✅ Component Library (Base)
✅ Home Experience
✅ AI Engine Foundation
✅ AI Caddie
✅ CaddieBook
✅ AI Hole Strategy
✅ AI Shot Plan
✅ Home Redesign v3.0 Phase 2 - Hero Top Buttons
✅ Home Weather Acquisition

## Current Task

Home Hero에서 예정 라운드별 날씨 정보를 입수해 표시하도록 연결했다.

- OpenWeather 5일 예보 API 사용
- 라운드 날짜 + Tee Off 시간에 가까운 예보 선택
- Hero의 날씨/기온/풍속 값에 실제 API 데이터 연결
- API Key 없거나 호출 실패 시 기존 fallback 유지

## Verified

- 업로드된 `src.zip`, `docs.zip` 기준 실제 소스/문서 수정 완료
- 전체 프로젝트 루트 설정 파일이 없어 전체 TypeScript 검증은 로컬 프로젝트에서 재실행 필요

## Next Task

- Expo 실기기에서 날씨 표시 확인
- `EXPO_PUBLIC_OPENWEATHER_API_KEY` 환경변수 적용 확인
- 골프장 좌표 저장/캐싱 구조 검토

## Do Not Touch

- Authentication
- Invite
- Payment
- Existing DB Schema without explicit SQL approval


## Current Update - Home v3 Phase 2

- Hero와 캐디 카드의 곡선 연결 UI를 적용했다.
- 클럽 선택 버튼은 메뉴 이동 대신 드롭다운형 클럽 선택 모달로 동작한다.
- 선택된 클럽은 `ClubContext`의 activeClub로 반영되며 Home Dashboard hook이 해당 클럽 기준으로 데이터를 다시 조회한다.
