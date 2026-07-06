# GogoPar Framework v1.0 - App Architecture

## 1. 목표

GogoPar는 단순 골프 동호회 앱이 아니라 골퍼의 라운드 준비, 기록, 추억, 동호회 활동을 연결하는 Golf Life Platform이다.

따라서 화면 단위로 개발하지 않고, 아래 계층 구조를 기준으로 개발한다.

```text
App Layer
↓
Feature Layer
↓
Shared UI Layer
↓
Core Service Layer
↓
Data Layer
↓
Supabase / External API
```

---

## 2. Layer 구조

### App Layer
앱 진입점, 라우팅, 전역 Provider, 인증 흐름을 담당한다.

예:
```text
src/app/
```

### Feature Layer
업무 기능 단위 화면과 로직을 담당한다.

예:
```text
src/features/home/
src/features/round/
src/features/club/
src/features/record/
src/features/caddiebook/
```

### Shared UI Layer
여러 화면에서 재사용하는 UI 컴포넌트를 담당한다.

예:
```text
src/shared/ui/
```

### Core Layer
공통 서비스, 유틸, 타입, API 클라이언트, 저장소 로직을 담당한다.

예:
```text
src/core/
```

### Asset Layer
Hero 이미지, 캐릭터, 아이콘, 패턴, 배경 이미지를 관리한다.

예:
```text
src/assets/
```

---

## 3. 데이터 흐름

```text
Screen
↓
Feature Hook
↓
Service
↓
Repository
↓
Supabase / Weather API / AI API
```

화면 컴포넌트는 직접 Supabase를 호출하지 않는다.

---

## 4. Home V2 기준 구조

```text
HomeScreenV2
↓
useHomeViewModel
↓
homeService
↓
roundRepository
courseRepository
weatherService
```

---

## 5. 개발 원칙

- 화면은 조립한다.
- 비즈니스 로직은 Hook 또는 Service에 둔다.
- UI 컴포넌트는 데이터 조회를 하지 않는다.
- Supabase 호출은 Repository에 모은다.
- 디자인 값은 Theme Token을 사용한다.
- 새 기능은 반드시 Feature 폴더 아래에 만든다.
