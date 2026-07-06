# GogoPar Hero System

## 1. Hero의 목적

Hero는 단순 배경 이미지가 아니다.  
사용자가 앱을 켰을 때 골프장에 도착한 느낌을 주는 첫 장면이다.

---

## 2. Hero 기본 구조

```text
Layer 1: Golf Course Illustration
Layer 2: Gradient Overlay
Layer 3: Text Information
```

---

## 3. Hero 표시 정보

Hero 안에는 아래 정보만 표시한다.

```text
Greeting
Course Name
Weather
D-Day
Tee Time
```

버튼, 캐릭터, 긴 설명은 Hero 안에 넣지 않는다.

---

## 4. Hero 상태

### 예정 라운드 있음
- 해당 골프장 Hero 표시
- D-Day, Tee Time 표시

### 예정 라운드 없음
- 추천 골프장 Hero 또는 계절 Hero 표시
- 라운드 등록 유도 메시지는 Gogo Card에서 처리

### 비 오는 날
- Rain Hero 사용
- Gogo Card에서 실내 연습 메시지 표시

### 계절 Hero
- 봄: 벚꽃, 따뜻한 햇살
- 여름: 푸른 하늘, 진한 잔디
- 가을: 단풍, 부드러운 노을
- 겨울: 눈, 차분한 분위기

---

## 5. Hero 이미지 규격

원본:

```text
2048 x 1024
Ratio 2:1
```

앱 표시:

```text
Full width
Height 320~360
```

---

## 6. Hero 스타일

- 사진보다 AI 일러스트 스타일을 우선한다.
- GogoPar만의 통일된 색감을 유지한다.
- 텍스트가 올라갈 좌측 영역은 너무 복잡하지 않게 한다.
- 하단에는 어두운 Gradient를 깔아 가독성을 확보한다.

---

## 7. Hero Metadata

Hero 하나는 아래 정보를 가진다.

```yaml
id:
courseName:
theme:
season:
weather:
timeOfDay:
imageUrl:
primaryColor:
overlayColor:
textColor:
```

---

## 8. Hero 금지 사항

- Hero 안에 버튼 3개 이상 배치 금지
- 텍스트 6줄 이상 금지
- 저작권 불명확한 사진 사용 금지
- 골프장별 색감이 지나치게 달라지는 것 금지
