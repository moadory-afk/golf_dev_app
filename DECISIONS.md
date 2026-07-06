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


# DECISIONS - Home v3.7 Addendum

## ADR-013. Home Greeting은 Header가 아니라 Concierge 카드에 둔다

### 결정
상단 Header는 클럽 선택, 공지사항, 프로필만 유지하고, 사용자 인사는 Concierge 카드에서 처리한다.

### 이유
- Header는 앱 조작 영역이고, Concierge 카드는 개인화 메시지 영역이다.
- Home의 첫 줄을 가볍게 만들어 Hero 집중도를 높인다.

## ADR-014. Concierge 카드의 교통상황 블록은 제거한다

### 결정
Concierge 카드 아래의 교통상황 상세 블록은 삭제한다.

### 이유
- 날씨, 풍속, 이동시간, 출발 추천은 Hero 하단 Strip에서 이미 제공한다.
- 같은 정보를 카드 아래에 반복하면 Home이 길어지고 시선이 분산된다.
