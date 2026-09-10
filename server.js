require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// uploads 및 data 필수 폴더 자동 생성
const uploadDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    maxAge: 1000 * 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// 라우터 연결
app.use('/', studentRoutes);
app.use('/teacher', authRoutes);
app.use('/teacher', teacherRoutes);

app.use((req, res) => {
  res.status(404).send('페이지를 찾을 수 없습니다.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
