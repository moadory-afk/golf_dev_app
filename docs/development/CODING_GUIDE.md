# GogoPar Coding Guide

## 1. Naming

### Component
```text
GPButton.tsx
GPHero.tsx
GogoCard.tsx
```

### Hook
```text
useHomeViewModel.ts
useWeather.ts
```

### Service
```text
homeService.ts
weatherService.ts
```

### Repository
```text
roundRepository.ts
courseRepository.ts
```

---

## 2. Component 작성 원칙

- Props 타입을 명확히 작성한다.
- API 호출을 하지 않는다.
- Theme Token을 사용한다.
- 기본값을 제공한다.
- 화면 로직을 포함하지 않는다.

---

## 3. Screen 작성 원칙

Screen은 화면 조립만 담당한다.

```text
데이터 조회
상태 판단
이벤트 연결
컴포넌트 조립
```

---

## 4. Service 작성 원칙

Service는 비즈니스 로직을 담당한다.

예:
```text
예정 라운드 찾기
D-Day 계산
Gogo 메시지 선택
날씨 상태 판단
```

---

## 5. Repository 작성 원칙

Supabase 호출은 Repository에만 둔다.

Screen 또는 Component에서 Supabase 직접 호출 금지.

---

## 6. Error Handling

- undefined 표시 금지
- API 실패 시 fallback 표시
- 앱 전체가 깨지면 안 됨
- 날씨 실패는 Hero 표시를 막지 않음
