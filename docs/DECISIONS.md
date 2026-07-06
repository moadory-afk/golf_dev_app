# DECISIONS

프로젝트의 주요 설계 결정을 기록한다.

---

## 2026-07-06

### Home은 Hero 중심으로 설계한다.

이유:
- 골프장에 도착한 느낌 제공
- 브랜드 경험 강화

---

### Theme Token 사용

이유:
- 다크모드 대응
- 스킨 시스템 대응
- 디자인 일관성

---

### Feature 기반 구조 채택

이유:
- 기능 단위 유지보수
- 화면 확장 용이

---

### UI Kit 기반 개발

이유:
- 재사용성 향상
- 개발 속도 향상
- 디자인 일관성

---

### Hero는 AI 일러스트 스타일 사용

이유:
- 통일된 브랜드 경험
- 저작권 문제 최소화

---

## 2026-07-06

### Home 데이터는 Repository → Service → Mapper → Hook → Screen 구조로 분리한다.

이유:
- Screen에서 Supabase 직접 호출을 제거하기 위해서다.
- Home UI를 데이터 소스 변경과 분리하기 위해서다.
- 향후 AI Caddie, Round, Stats, Community도 같은 패턴으로 확장하기 위해서다.

### Home의 다음 라운드는 `rounds`가 아니라 `club_round_schedules`를 기준으로 조회한다.

이유:
- `rounds`는 경기 기록에 가깝다.
- Home Hero와 Upcoming Round는 아직 진행 전인 예정 일정을 보여줘야 한다.
- 모집, 조편성, 티오프, 멤버 수는 `club_round_schedules`와 관련 테이블이 더 적합하다.
