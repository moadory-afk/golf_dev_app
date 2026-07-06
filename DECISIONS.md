# DECISIONS.md

# GogoPar Architecture Decisions

이 문서는 GogoPar 프로젝트의 중요한 설계 결정을 기록한다.

목적은 시간이 지나도 “왜 이렇게 만들었는지”를 잊지 않기 위함이다.

---

## ADR-001. Feature 기반 폴더 구조를 사용한다

### 결정

GogoPar는 기능 단위로 코드를 관리한다.

```txt
src/features/
  home/
    api/
    hooks/
    services/
    mappers/
    types/
    components/
```

### 이유

- 기능별 책임이 명확해진다.
- Home, Round, Caddie, Stats, Community 기능을 독립적으로 확장할 수 있다.
- 화면이 커져도 유지보수가 쉽다.
- 장기적으로 Premium Golf Platform 구조에 적합하다.

### 규칙

- 화면에서 직접 API를 호출하지 않는다.
- 기능별 데이터 접근은 해당 feature의 `api` 폴더에서 담당한다.
- 화면은 hook과 component만 사용한다.

---

## ADR-002. Repository 패턴을 사용한다

### 결정

Supabase 호출은 Repository에서만 수행한다.

```txt
Screen
↓
Hook
↓
Service
↓
Repository
↓
Supabase
```

### 이유

- Supabase 구조가 바뀌어도 화면 수정 범위를 줄일 수 있다.
- Mock 데이터와 실제 데이터를 쉽게 교체할 수 있다.
- 테스트와 유지보수가 쉬워진다.
- DB 쿼리 책임이 한곳에 모인다.

### 금지

```ts
// 금지
supabase.from('rounds').select('*')
```

위 코드를 Screen 또는 Component에서 직접 사용하지 않는다.

---

## ADR-003. Home Dashboard는 하나의 View Model로 관리한다

### 결정

Home 화면은 여러 데이터를 직접 조합하지 않고 `HomeDashboard` 모델 하나를 사용한다.

```ts
HomeDashboard
├── hero
├── upcomingRound
├── aiCaddie
├── stats
├── quickMenus
└── community
```

### 이유

- Home 화면의 데이터 흐름이 단순해진다.
- Mock → Supabase 전환이 쉽다.
- 각 카드 컴포넌트가 필요한 데이터만 받도록 만들 수 있다.
- 향후 Weather, AI Caddie, Stats 연결이 쉬워진다.

---

## ADR-004. Hook은 화면의 ViewModel 역할을 한다

### 결정

Home 화면은 `useHomeDashboard()` hook을 통해 데이터를 사용한다.

```ts
const { dashboard, loading, error, refresh } = useHomeDashboard();
```

### 이유

- 로딩, 에러, 새로고침 상태를 한곳에서 관리할 수 있다.
- Screen은 UI 배치에만 집중할 수 있다.
- Skeleton Loading과 Empty State 적용이 쉬워진다.

---

## ADR-005. Design Token을 우선 사용한다

### 결정

색상, 간격, radius, shadow, typography는 Design Token을 우선 사용한다.

### 이유

- 디자인 일관성을 유지할 수 있다.
- Apple + Garmin + Premium Golf 컨셉을 안정적으로 확장할 수 있다.
- Theme / Skin 변경 시 전체 UI를 쉽게 조정할 수 있다.

### 금지

- 색상 하드코딩 금지
- spacing 하드코딩 최소화
- 카드 안에 카드 중첩 금지
- Section 안에 Section 중첩 금지

---

## ADR-006. Screen → Section → Card → Widget 구조를 유지한다

### 결정

UI 계층은 다음 구조를 따른다.

```txt
Screen
↓
Section
↓
Card
↓
Widget
```

### 이유

- 화면 구조가 명확해진다.
- 컴포넌트 재사용성이 높아진다.
- 디자인 품질을 일정하게 유지할 수 있다.

---

## ADR-007. Mock 데이터는 임시 계층에 둔다

### 결정

Mock 데이터는 화면 안에 직접 두지 않는다.

Mock이 필요하면 Repository 또는 Service 계층에서 실제 데이터와 동일한 모델로 반환한다.

### 이유

- 실제 DB 연결 시 화면 수정이 줄어든다.
- 개발 초기에도 실제 구조와 동일하게 테스트할 수 있다.
- Mock 제거 시 안전하다.

---

## ADR-008. DB 변경은 SQL로 분리 제공한다

### 결정

DB 변경이 필요한 경우, 앱 코드와 분리하여 SQL 쿼리로 작성한다.

사용자가 Supabase에서 직접 실행한 뒤 앱 개발을 진행한다.

### 이유

- DB 변경 내역을 명확히 관리할 수 있다.
- 운영 DB에 대한 직접 변경 위험을 줄인다.
- 앱 코드 변경과 DB 변경을 분리할 수 있다.

---

## ADR-009. 작업 완료 기준

### 결정

작업 완료는 다음 조건을 모두 만족해야 한다.

- 실제 파일 수정 완료
- TypeScript 검증 완료
- 변경 파일 목록 정리
- 관련 문서 업데이트
- 변경된 파일만 ZIP으로 제공

### 필수 업데이트 문서

- CHANGELOG.md
- NEXT.md
- PROJECT_STATUS.md

필요 시 함께 업데이트한다.

- COMPONENT_GUIDE.md
- UI_RULES.md
- ARCHITECTURE.md
- README.md
- AGENTS.md
- CLAUDE.md
- docs/**/*.md

---

## ADR-010. 완료하지 않은 작업은 완료했다고 말하지 않는다

### 결정

실제 구현하지 않은 작업은 구현했다고 말하지 않는다.

### 이유

GogoPar 프로젝트는 장기 프로젝트이며, 신뢰 가능한 작업 이력이 가장 중요하다.

### 원칙

- 확인하지 않은 것은 확인했다고 말하지 않는다.
- 수정하지 않은 ZIP을 제공하지 않는다.
- 테스트하지 않은 것은 테스트했다고 말하지 않는다.
- 실패한 작업은 실패 이유를 명확히 설명한다.

---

## Next Decision Candidates

다음 설계 결정은 Sprint 2 진행 중 확정한다.

- Home Repository 상세 쿼리 구조
- Supabase 타입 자동 생성 여부
- Weather API 연동 방식
- AI Caddie 데이터 우선순위
- Stats 계산 위치
- Cache / Refresh 정책
- Offline 대응 정책
