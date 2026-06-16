# When2Meet 클론 - 회의 시간 조율 사이트

## Overview
5명(경민, 규리, 정호, 아윤, 고운)이 회의 시간을 잡기 위한 When2Meet 스타일 가용시간 조율 사이트.

## Tech Stack
- **HTML / CSS / JavaScript** (프레임워크 없음)
- Firebase Realtime Database (CDN, compat 모드)
- 단일 페이지 구조: `index.html` + `style.css` + `script.js` + `firebase-config.js`

## 핵심 기능
1. **이벤트 생성**: 제목 + 후보 날짜(달력 다중 선택) + 시간 범위(30분 단위) → 고유 ID로 URL 공유
2. **가용시간 입력**: 멤버 선택 후 날짜×시간 그리드에서 드래그로 가능 시간 칠하기, 실시간 Firebase 저장
3. **결과 보기**: 겹침 인원수를 색 농도로 표시(1명=연한색→5명=진한색), hover 시 가능 멤버 표시

## 멤버 (고정)
경민, 규리, 정호, 아윤, 고운

## Firebase 구조
```json
{
  "events": {
    "<eventId>": {
      "title": "이번주 회의",
      "dates": ["2026-04-13", "2026-04-14"],
      "timeRange": { "start": 9, "end": 22 },
      "availability": {
        "경민": { "2026-04-13": ["09:00","09:30",...] }
      }
    }
  }
}
```

## Firebase 설정
- `firebase-config.js`에 config 값 입력 필요
- Realtime Database 규칙: 테스트용 read/write true

## UI 디자인
- 심플하고 깔끔한 디자인, 그린 계열 가용시간 표시
- When2Meet과 유사한 그리드 레이아웃
- 반응형 (모바일 대응)

## 파일 구조
```
when2meet/
├── CLAUDE.md
├── index.html
├── style.css
├── script.js
└── firebase-config.js
```

## Work Style
- 애매한 부분은 반드시 질문
- 확정된 계획은 이 CLAUDE.md에 반영
