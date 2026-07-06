# Hero_Workflow.md

## 제작 프로세스

``` text
골프장명
   │
   ▼
ChatGPT
   ├─ research.md
   ├─ hero_prompt.md
   ├─ metadata.json
   ├─ insert.sql
   ▼
Gemini
   ├─ 웹 리서치
   ├─ 실제 사진 분석
   ├─ Hero 이미지 생성
   ▼
검수
   ├─ 대표홀 일치
   ├─ UI Safe Area
   ├─ 실사 재현성
   ▼
DB 등록
   ▼
WebP 변환
   ▼
GogoPar Hero 적용
```

## 품질 기준

-   실제 골프장 재현성 우선
-   브랜드보다 정확성 우선
-   골퍼가 즉시 알아볼 수 있는 이미지
-   시즌/날씨 확장 가능
