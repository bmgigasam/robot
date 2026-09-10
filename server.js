// server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const studentRoutes = require('./routes/student');
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');

const app = express();
// 서버 시작 시 초기 교사 계정 자동 생성/재설정
const db = require('./db');
const bcrypt = require('bcryptjs');

function initTeacher() {
  try {
    const hash = bcrypt.hashSync('1234', 10);
    const teacher = db.prepare('SELECT * FROM teachers WHERE username = ?').get('admin');
    
    if (!teacher) {
      db.prepare('INSERT INTO teachers (username, password_hash) VALUES (?, ?)').run('admin', hash);
      console.log('교사 계정 신규 생성 완료 (admin / 1234)');
    } else {
      db.prepare('UPDATE teachers SET password_hash = ? WHERE username = ?').run(hash, 'admin');
      console.log('교사 비밀번호 bcryptjs 암호화 재설정 완료 (admin / 1234)');
    }
  } catch (err) {
    console.error('교사 계정 설정 오류:', err);
  }
}
initTeacher();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Render/Railway 등 프록시 뒤에서 배포 시 secure 쿠키가 정상 동작하도록

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// 주의: uploads/ 폴더는 절대 express.static으로 공개하지 않는다.
// 학생이 올린 파일은 오직 /teacher/submissions/:id/download (로그인 필요)로만 받을 수 있다.

if (!process.env.SESSION_SECRET) {
  console.warn('[경고] SESSION_SECRET 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8, // 8시간
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// 학생용 페이지 (루트) - 로그인 불필요
app.use('/', studentRoutes);

// 교사 로그인/로그아웃 (비밀번호 확인 후에만 세션 발급)
app.use('/teacher', authRoutes);

// 교사 전용 페이지 - middleware/auth.js의 requireTeacherLogin이 내부에서 보호
app.use('/teacher', teacherRoutes);

app.use((req, res) => {
  res.status(404).send('페이지를 찾을 수 없습니다.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
