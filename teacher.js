// routes/teacher.js - 교사 전용 기능 (로그인 필수)
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireTeacherLogin } = require('../middleware/auth');

const router = express.Router();

// 이 라우터의 모든 경로는 로그인한 교사만 접근 가능
router.use(requireTeacherLogin);

router.get('/dashboard', (req, res) => {
  const assignments = db.prepare(`
    SELECT a.*, COUNT(s.id) AS submission_count
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all();

  res.render('teacher_dashboard', {
    teacherUsername: req.session.teacherUsername,
    assignments,
  });
});

router.get('/assignments/new', (req, res) => {
  res.render('assignment_new');
});

router.post('/assignments', (req, res) => {
  const { title, description, due_date } = req.body;
  if (!title || !title.trim()) {
    return res.render('assignment_new', { error: '제목을 입력해주세요.' });
  }
  db.prepare('INSERT INTO assignments (title, description, due_date) VALUES (?, ?, ?)')
    .run(title.trim(), description || '', due_date || null);
  res.redirect('/teacher/dashboard');
});

router.get('/assignments/:id', (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!assignment) return res.status(404).send('과제를 찾을 수 없습니다.');

  const submissions = db.prepare(
    'SELECT * FROM submissions WHERE assignment_id = ? ORDER BY submitted_at DESC'
  ).all(req.params.id);

  res.render('assignment_detail', {
    assignment,
    submissions,
    resetSubmissionId: req.query.resetSubmissionId ? Number(req.query.resetSubmissionId) : null,
    tempPassword: req.query.tempPassword || null,
  });
});

router.post('/assignments/:id/delete', (req, res) => {
  const submissions = db.prepare('SELECT * FROM submissions WHERE assignment_id = ?').all(req.params.id);
  submissions.forEach((s) => {
    const filePath = path.join(__dirname, '..', 'uploads', s.stored_filename);
    fs.unlink(filePath, () => {}); // 실패해도 무시
  });
  db.prepare('DELETE FROM submissions WHERE assignment_id = ?').run(req.params.id);
  db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
  res.redirect('/teacher/dashboard');
});

// 제출된 파일 다운로드 - 교사만 접근 가능 (uploads 폴더는 public이 아니므로
// 반드시 이 라우트를 통해서만 파일에 접근할 수 있다)
router.get('/submissions/:id/download', (req, res) => {
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!submission) return res.status(404).send('제출물을 찾을 수 없습니다.');

  const filePath = path.join(__dirname, '..', 'uploads', submission.stored_filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('파일이 존재하지 않습니다.');

  res.download(filePath, submission.original_filename);
});

// 학생이 제출물 비밀번호를 잊어버렸을 때, 교사가 임시 비밀번호로 초기화해준다.
// 초기화된 비밀번호는 이 요청의 응답에서 딱 한 번만 평문으로 보여주고 저장하지 않는다.
router.post('/submissions/:id/reset-password', (req, res) => {
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!submission) return res.status(404).send('제출물을 찾을 수 없습니다.');

  // 학생이 알아보고 전달받기 쉬운 6자리 숫자 임시 비밀번호 생성
  const tempPassword = crypto.randomInt(100000, 999999).toString();
  const passwordHash = bcrypt.hashSync(tempPassword, 10);

  db.prepare('UPDATE submissions SET student_password_hash = ? WHERE id = ?').run(passwordHash, submission.id);

  res.redirect(`/teacher/assignments/${submission.assignment_id}?resetSubmissionId=${submission.id}&tempPassword=${tempPassword}`);
});

module.exports = router;
