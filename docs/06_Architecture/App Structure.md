# 앱 구조 문서

## 목적

이 문서는 현재 `src` 구조를 사람이 먼저 이해할 수 있게 정리한 기준 문서다.

회비 관리 기능을 추가하기 전에, 현재 프로그램이 어떤 구조로 움직이는지 먼저 파악하는 용도로 사용한다.

## 현재 구조

```text
src
 ├── components
 ├── features
 ├── navigation
 ├── screens
 └── lib
```

## 폴더별 역할

### components

여러 화면에서 공통으로 사용하는 UI 구성 요소를 둔다.

예:
- `AppTabBar`
- `AppHeader`
- `DateField`
- `UserAvatar`

즉, 화면을 구성하는 공통 표현 계층이다.

### features

`features`는 화면 폴더가 아니다.

현재 프로젝트에서 `features`는 Business Logic를 담당한다.

예:
- `ocr`
- `shinperio`
- `settlement`

즉, 계산 규칙, 처리 로직, 기능 규칙을 두는 곳이며 Feature Architecture 관점의 화면 묶음 폴더로 해석하지 않는다.

### navigation

앱의 화면 이동 구조와 타입을 관리한다.

현재 Bottom Navigation과 Stack 화면 구성이 여기서 정리된다.

### screens

실제 사용자가 보는 화면을 둔다.

현재 구조상 홈, 클럽, 기록, 라운드 설정, 회원 관리, 결과 화면 등 주요 사용자 흐름이 여기에 구현되어 있다.

### lib

공통 유틸리티와 기반 기능을 둔다.

예:
- `supabase`
- `ClubContext`
- `store`
- `nameMatch`
- `useAsync`

즉, 데이터 연결, 공통 상태, 보조 함수 계층이다.

## 현재 구조 해석

현재 앱은 아래 흐름으로 이해하면 된다.

1. `navigation`이 큰 이동 구조를 잡는다.
2. `screens`가 실제 사용자 화면을 담당한다.
3. `components`가 화면을 조립한다.
4. `features`가 계산과 규칙 로직을 담당한다.
5. `lib`가 연결과 공통 기반을 담당한다.

## 회비 관리 도입 시 주의점

- 새로운 Business Logic가 필요하면 `features`에 둔다.
- 새로운 운영 화면이 필요하면 `screens`에 둔다.
- 공통 입력/리스트 UI가 필요하면 `components`에서 재사용한다.
- 데이터 연결은 `lib` 또는 관련 데이터 계층에서 정리한다.
- 기존 폴더 역할을 바꾸지 않는다.
