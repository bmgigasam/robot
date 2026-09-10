# 과제 업로드 사이트

학생이 로그인 없이 과제 파일을 제출하고, 교사만 비밀번호로 로그인해 제출물을 확인·다운로드할 수 있는 사이트입니다.

## 주요 특징

- **교사 로그인**: 아이디+비밀번호(bcrypt 해시 저장), 세션 기반. 학생은 이 계정으로 로그인할 방법이 없습니다(회원가입 기능 자체가 없고, 교사 계정은 서버 CLI로만 생성).
- **학생 제출**: 로그인 없이 이름/학번/비밀번호 입력 후 파일 업로드.
- **제출물 비밀번호(필수)**: 학생이 제출할 때 직접 정하는 비밀번호입니다(4자 이상). 교사 로그인 비밀번호와는 완전히 별개이며, bcrypt로 해시만 저장합니다. 이 비밀번호로 나중에 "내 제출물 확인/재제출/삭제"가 가능합니다. 다른 사람은 이름+비밀번호를 모두 정확히 알아야만 그 제출물에 접근할 수 있습니다.
- 업로드된 파일은 `uploads/` 폴더에 저장되고, 웹에 공개되지 않으며, 교사는 로그인 후 다운로드 가능하고 학생 본인은 이름+비밀번호로만 접근 가능합니다.

## 처음 실행하기

```bash
npm install
cp .env.example .env
# .env 파일을 열어 SESSION_SECRET을 임의의 긴 문자열로 변경하세요.

# 교사 계정 생성 (아이디, 비밀번호는 원하는 값으로)
npm run init-teacher -- teacher "아주안전한비밀번호123"

npm start
```

브라우저에서:
- 학생용: http://localhost:3000/
- 교사용: http://localhost:3000/teacher/login

## 교사 비밀번호 변경

같은 명령을 다시 실행하면 비밀번호가 갱신됩니다.

```bash
npm run init-teacher -- teacher "새비밀번호"
```

## 학생이 제출물을 나중에 확인/재제출/삭제하는 방법

1. 학생 화면(과제 목록 또는 제출 화면)에서 "내 제출물 확인/재제출/삭제" 클릭
2. 제출할 때 썼던 이름과 비밀번호 입력
3. 일치하면 현재 제출된 파일을 확인하고, 새 파일로 교체하거나 삭제할 수 있습니다.

## 학생이 비밀번호를 잊어버렸을 때 (교사가 초기화)

1. 교사로 로그인 → 해당 과제 상세 페이지
2. 제출물 목록에서 학생 행의 "비밀번호 초기화" 클릭
3. 화면에 6자리 임시 비밀번호가 **한 번만** 표시됩니다 (새로고침하면 다시 볼 수 없음) → 이 값을 학생에게 전달
4. 학생은 원래 이름 + 이 임시 비밀번호로 "내 제출물 확인"에 들어가 재제출/삭제 가능

> 임시 비밀번호도 즉시 해시로만 저장되고 평문으로는 남지 않으므로, 화면에서 놓치면 다시 초기화해야 합니다.

## 배포 (Render 기준 예시)

1. GitHub에 이 프로젝트를 올립니다 (`.env`, `data/`, `uploads/`는 `.gitignore`로 제외됨).
2. Render.com → New Web Service → 저장소 연결
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment 탭에서 `SESSION_SECRET`, `NODE_ENV=production` 추가
6. 배포 후 Render의 Shell 탭에서 한 번 실행: `npm run init-teacher -- teacher "비밀번호"`

> ⚠️ 주의: Render 무료 플랜은 재배포 시 디스크가 초기화될 수 있습니다. 실제 운영에서는 "Persistent Disk"를 `data/`와 `uploads/` 경로에 마운트하거나, Railway/Fly.io 등 디스크가 유지되는 플랫폼을 사용하세요. 학생 수가 많고 장기 운영할 계획이면 나중에 SQLite를 PostgreSQL로 바꾸는 것도 고려할 수 있습니다.

## 폴더 구조

```
server.js              앱 진입점
db.js                  SQLite 스키마 및 연결
uploadConfig.js         파일 업로드(multer) 설정
middleware/auth.js      교사 로그인 여부 확인 미들웨어
routes/auth.js          교사 로그인/로그아웃
routes/teacher.js       교사 전용: 대시보드, 과제 등록/삭제, 제출물 다운로드
routes/student.js       학생용: 과제 목록, 업로드 폼, 제출 처리
views/                  화면(EJS 템플릿)
scripts/set-teacher-password.js  교사 계정 생성/비밀번호 변경 CLI
```

## 보안 관련 메모

- 비밀번호(교사 로그인, 학생 제출물 비밀번호)는 모두 bcrypt로 해시하여 저장합니다.
- 교사 로그인은 10분 내 8회 실패 시 잠깁니다(무차별 대입 방지).
- 세션 쿠키는 `httpOnly`이며, `NODE_ENV=production`일 때 `secure` 옵션이 켜집니다(반드시 https로 배포하세요).
- 업로드 파일 확장자를 화이트리스트로 제한하고, 파일당 20MB로 제한합니다. 필요시 `uploadConfig.js`에서 조정하세요.
