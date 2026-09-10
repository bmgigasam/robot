// routes/student.js
// 학생은 로그인 없이 이 라우트들만 사용한다.
// 이 파일에는 교사 인증 관련 코드가 전혀 없으므로,
// 학생이 어떤 값을 보내도 교사 세션을 얻거나 /teacher/* 라우트에 접근할 방법이 없다.
//
// 제출 비밀번호(student_password_hash)는 학생이 제출할 때 직접 정하는 비밀번호로,
// (1) 나중에 본인이 재제출/수정/삭제할 때 본인 확인용
// (2) 다른 사람이 함부로 내 제출물을 건드리지 못하게 하는 용도
// 로 쓰인다. 교사 로그인 비밀번호와는 완전히 별개이며, 서버는 해시만 저장한다.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db');

// 파일 업로드 설정 (uploads 폴더에 저장)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// 학생 메인 페이지 (과제 목록)
router.get('/', (req, res) => {
  try {
    const assignments = db.prepare('SELECT * FROM assignments ORDER BY id DESC').all();
    res.render('index', { assignments });
  } catch (err) {
    console.error(err);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 학생 과제 제출 페이지
router.get('/assignments/:id', (req, res) => {
  try {
    const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
    if (!assignment) {
      return res.status(404).send('과제를 찾을 수 없습니다.');
    }
    res.render('student_upload', { assignment });
  } catch (err) {
    console.error(err);
    res.status(500).send('서버 오류가 발생했습니다.');
  }
});

// 학생 과제 제출 처리 (POST)
router.post('/assignments/:id/submit', upload.single('file'), (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { student_name, student_number, password, comment } = req.body;

    if (!req.file) {
      return res.status(400).send('파일을 업로드해 주세요.');
    }
    if (!student_name || !student_number || !password) {
      return res.status(400).send('이름, 학번, 비밀번호를 모두 입력해 주세요.');
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const originalFilename = req.file.originalname;
    const storedFilename = req.file.filename;

    const stmt = db.prepare(`
      INSERT INTO submissions (assignment_id, student_name, student_number, original_filename, stored_filename, student_password_hash, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(assignmentId, student_name.trim(), student_number.trim(), originalFilename, storedFilename, passwordHash, comment ? comment.trim() : '');

    res.send(`
      <script>
        alert('과제가 성공적으로 제출되었습니다!');
        location.href = '/';
      </script>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('과제 제출 중 오류가 발생했습니다.');
  }
});

module.exports = router;
