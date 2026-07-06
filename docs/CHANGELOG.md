# CHANGELOG - Home Redesign v3.0 Phase 2 Caddie Actions Relocation

## Changed
- Hero 카드 내부의 `캐디맵`, `조편성`, `Lotto` 액션 버튼을 제거했다.
- 동일 액션을 Today's AI / 캐디 카드 하단 액션 영역으로 이동했다.
- 캐디 카드 하단 액션은 첫 번째 예정 라운드를 기준으로 `CaddieBook`, 조편성 팝업, Lotto 팝업 동작에 연결했다.

## Files
- `src/features/home/components/PremiumHomeHeroSection.tsx`
- `src/screens/HomeExperienceScreen.tsx`
- `docs/CHANGELOG.md`
- `docs/NEXT.md`
- `docs/PROJECT_STATUS.md`

## DB
- 변경 없음

## Verified
- 업로드된 `src.zip`, `docs.zip` 기준으로 실제 파일 수정 완료
- Hero 컴포넌트에서 액션 버튼 렌더링 블록 제거 확인
- 전체 프로젝트 루트에 `package.json`, `tsconfig.json`이 포함되지 않아 `tsc --noEmit` 전체 검증은 실행하지 못함

## Preserved
- Hero Carousel 구조 유지
- Hero 상단 클럽/공지/프로필 오버레이 유지
- Statistics 구조 유지
- DB Schema 변경 없음

# CHANGELOG - Home Redesign v3.0 Phase 2 Hero Top Buttons

## Changed
- Hero 상단의 클럽 선택, 공지, 프로필 버튼을 Hero 카드 내부 오버레이로 이동했다.
- 상단 버튼의 흰색 카드 배경을 제거하고 Hero 이미지 위에 올라가는 반투명/투명 계열 버튼으로 정리했다.
- 클럽 선택 버튼 크기를 축소해 Hero 이미지 노출 영역을 넓혔다.
- Hero 본문이 상단 버튼과 겹치지 않도록 슬라이드 상단 여백을 조정했다.
- 프로필 버튼 클릭 시 `Profile` 화면으로 이동하도록 연결했다.

## Files
- `src/features/home/components/PremiumHomeHeroSection.tsx`
- `src/screens/HomeExperienceScreen.tsx`

## DB
- 변경 없음

## Verified
- 업로드된 `src.zip` 기준으로 실제 파일 수정 완료
- 전체 프로젝트 루트에 `package.json`, `tsconfig.json`이 포함되지 않아 `tsc --noEmit` 전체 검증은 실행하지 못함

## Preserved
- Hero Carousel 구조 유지
- Statistics 구조 유지
- AI Caddie Card 구조 유지
- DB Schema 변경 없음

# CHANGELOG - AI Caddie Data Binding Sprint v2.4

## Added
- AI Caddie Data Binding 추가
  - `src/features/caddie/api/caddieRepository.ts`
  - `src/features/caddie/mappers/caddieMapper.ts`
  - `src/features/caddie/services/caddieService.ts`
  - `src/features/caddie/hooks/useAICaddieData.ts`
  - `src/features/caddie/types/caddieData.ts`
- `user_distance_profiles`, `user_preferences`, `course_hole_guides` 조회를 AI Engine 입력값으로 매핑하는 구조를 추가했다.
- Home AI Caddie Card가 실제 추천 클럽, 유효거리, 위험도 메시지를 표시할 수 있도록 연결했다.

## Changed
- `HomeExperienceScreen`이 `userId`를 `useHomeDashboard`에 전달하도록 변경했다.
- `HomeService`가 Home Dashboard 생성 후 AI Caddie Preview를 비파괴적으로 병합하도록 변경했다.
- `PremiumGogoCaddieCard`가 기존 Mock 메시지와 Live Advice 메시지를 모두 지원하도록 확장했다.
- `HomeAiCaddie` 모델에 Live Advice 표시 필드를 추가했다.

## DB
- 이번 Sprint에서 DB 변경은 없다.
- 기존 `user_distance_profiles`, `user_preferences`, `course_hole_guides`를 사용한다.

## Verified
- 업로드된 파일은 `src` 단위라 전체 프로젝트 의존성 설치 상태가 없어 전체 `tsc --noEmit`은 실행하지 못했다.
- 순수 AI Engine 및 Mapper 파일은 `tsc --noEmit` 부분 검증을 통과했다.

## Preserved
- 기존 Navigation 변경 없음
- Authentication, Invite, Payment 기능 변경 없음
- 기존 DB Schema 변경 없음
