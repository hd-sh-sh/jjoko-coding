# 쪼코 코딩교실 (MVP)

초등 1학년 쪼물락코딩 8주 수업용 학습 웹앱. 기존 쪼물락 알파벳 맵 시뮬레이터에 로그인, 학습 기록, 선생님 대시보드, 주차별 피드백을 더했다.

## 지금 되는 것 (MVP)

- 학생 4자리 번호 로그인 (예시: 1001~1006), 선생님 번호 0000
- 학생 대시보드: 주차 선택, 개념학습 / 도전미션 / 코딩마스터(1~4주차 도전미션 성공 시 열림), 오른쪽 위 피드백 알림
- 개념학습: 예제 코드를 보고 먼저 결과를 예측(맵 칸 누르기 또는 보기 고르기)한 뒤 실행해 확인
- 도전미션 자동 판정과 틀린 유형 분류: 좌우 회전 혼동, 칸 수 하나 차이, 블록 순서 뒤바뀜, 끄기 빠뜨림, 도착 전 소리·LED, 벽 충돌, 못 가는 칸
- 선생님 대시보드: 주차 열기·마감, 반 현황, 주차별 많이 틀린 유형, 학생 상세(시도·예측 정답·보낸 피드백 기록)
- 주차 마감 → 학생별 피드백 + 보충문제 생성 → 학생 화면에 바로 알림, 소리로 읽어 주기
- 1~4주차(순차 구조)까지 구현. 5~8주차는 반복·조건 블록 추가 후 연다.

MVP 저장소는 브라우저 저장소라서 **같은 브라우저 안에서만** 데이터가 공유된다. 탭 두 개로 선생님/학생을 열면 실시간 알림을 확인할 수 있다. 피드백 문장은 정해 둔 규칙으로 만든다.

## 파이어베이스로 옮기기

1. Firebase 콘솔에서 프로젝트 생성 → 웹 앱 추가 → `firebaseConfig` 복사
2. Firestore 데이터베이스 만들기, `classes/1-1/students/{4자리번호}` 문서로 학생 번호 등록
3. Firebase AI Logic 시작하기 (Gemini Developer API 선택)
4. `index.html`의 `store` 블록을 `firebase-store.js`의 `createFirebaseStore(config)`로 교체,
   `closeWeek()`의 `writeFeedback(sm)`을 `await askGemini(sm, AI_RULES)`로 교체
5. 선생님 로그인은 Firebase Authentication(구글 로그인)으로 바꾸고, 보안 규칙에서 선생님만 weeks·feedback을 쓰게 막는다

## 깃 + 자동 배포

```bash
npm install -g firebase-tools
firebase login
firebase init hosting            # public 폴더 = 이 폴더
firebase init hosting:github     # main에 올리면 자동 배포, PR마다 미리보기 주소
```

## 저장소에 올리지 말 것

- 학생 번호 목록(번호 = 로그인 비밀번호). Firestore에만 등록한다.
- 서비스 계정 키 파일. 웹 설정값(apiKey 등)은 올려도 되지만 보안 규칙을 꼭 건다.
