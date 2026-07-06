# DECISIONS - v2.8.1 Addendum

## ADR-012. 캐디북은 설명서가 아니라 실행 계획이다

### 결정

GogoPar 캐디북은 홀 설명을 나열하는 화면이 아니라, 라운드 전에 사용자가 실행할 Shot Plan을 먼저 보여준다.

### 이유

- 골퍼가 경기 전에 가장 알고 싶은 것은 “무슨 클럽을 잡을지”다.
- 긴 설명보다 `D → 4H` 같은 실행 계획이 빠르게 이해된다.
- 사용자 비거리 기반 Shot Plan은 GogoPar만의 차별화 요소가 된다.

### 규칙

- AI Shot Plan은 Engine에서 생성한다.
- Mapper는 Engine 결과를 화면 모델로 연결한다.
- Screen은 Shot Plan을 계산하지 않고 표시만 한다.
- 세컨드 샷 입력은 요구하지 않는다. 티샷 결과 입력만 다음 Sprint에서 다룬다.

---

# ADR-013. Home은 Theme가 아니라 Layout Engine으로 확장한다

## 결정

Home 스킨은 색상과 Radius만 바꾸는 Theme 수준이 아니라, 섹션 순서와 슬롯 배치를 바꿀 수 있는 Layout Engine 구조로 확장한다.

## 이유

- GogoPar는 클럽/대회/프리미엄 스타일에 따라 완전히 다른 Home 구성이 필요할 수 있다.
- 디자인이 크게 바뀔 때마다 React 컴포넌트를 다시 작성하면 유지보수가 어려워진다.
- 데이터는 동일하게 유지하고, Layout Definition이 위치와 표시 여부를 결정하는 구조가 장기적으로 유리하다.

## 원칙

- 1차는 Home에만 적용한다.
- 좌표 기반 Free Layout은 바로 도입하지 않는다.
- 반응형 안정성을 위해 Slot 기반 Layout부터 적용한다.
