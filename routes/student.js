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
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const upload = require('../uploadConfig');

const router = express.Router();

function deleteFile(storedFilename) {
  fs.unlink(path.join(__dirname, '..', 'uploads', storedFilename), () => {});
}

// 이 브라우저 세션이 특정 제출물에 대해 비밀번호 확인을 마쳤는지 저장해두는 헬퍼.
// (express-session을 그대로 재사용하지만, 교사 세션 키(teacherId)와는 다른 키를 쓰므로 서로 섞이지 않는다.)
function markVerified(req, submissionId) {
  if (!req.session.verifiedSubmissions) req.session.verifiedSubmissions = {};
  req.session.verifiedSubmissions[submissionId] = true;
}
function isVerified(req, submissionId) {
  return !!(req.session.verifiedSubmissions && req.session.verifiedSubmissions[submissionId]);
}

router.get('/', (req, res) => {
  const assignments = db.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all();
  res.render('student_assignments', { assignments });
});

router.get('/assignments/:id', (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!assignment) return res.status(404).send('과제를 찾을 수 없습니다.');
  res.render('student_upload', { assignment, error: null });
});

// ── 제출 ──────────────────────────────────────────────
router.post('/assignments/:id/submit', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
      return res.render('student_upload', { assignment, error: err.message });
    }
    next();
  });
}, (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!assignment) return res.status(404).send('과제를 찾을 수 없습니다.');

  const cleanupUploadedFile = () => { if (req.file) deleteFile(req.file.filename); };
  const { student_name, student_number, submission_password, submission_password_confirm } = req.body;

  if (!req.file) {
    return res.render('student_upload', { assignment, error: '파일을 선택해주세요.' });
  }
  if (!student_name || !student_name.trim()) {
    cleanupUploadedFile();
    return res.render('student_upload', { assignment, error: '이름을 입력해주세요.' });
  }
  if (!submission_password || submission_password.length < 4) {
    cleanupUploadedFile();
    return res.render('student_upload', { assignment, error: '비밀번호를 4자 이상 입력해주세요.' });
  }
  if (submission_password !== submission_password_confirm) {
    cleanupUploadedFile();
    return res.render('student_upload', { assignment, error: '비밀번호 확인이 일치하지 않습니다.' });
  }

  const passwordHash = bcrypt.hashSync(submission_password, 10);

  db.prepare(`
    INSERT INTO submissions
      (assignment_id, student_name, student_number, original_filename, stored_filename, student_password_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    assignment.id,
    student_name.trim(),
    (student_number || '').trim(),
    req.file.originalname,
    req.file.filename,
    passwordHash
  );

  res.render('student_success', { assignment });
});

// ── 내 제출물 확인/재제출/삭제 ──────────────────────────
// 1) 이름 + 비밀번호 입력 → 일치하는 제출물 검색
router.get('/assignments/:id/manage', (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!assignment) return res.status(404).send('과제를 찾을 수 없습니다.');
  res.render('student_manage_login', { assignment, error: null });
});

router.post('/assignments/:id/manage', (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!assignment) return res.status(404).send('과제를 찾을 수 없습니다.');

  const { student_name, submission_password } = req.body;
  if (!student_name || !submission_password) {
    return res.render('student_manage_login', { assignment, error: '이름과 비밀번호를 모두 입력해주세요.' });
  }

  const candidates = db.prepare(
    'SELECT * FROM submissions WHERE assignment_id = ? AND LOWER(student_name) = LOWER(?)'
  ).all(req.params.id, student_name.trim());

  const match = candidates.find((s) => bcrypt.compareSync(submission_password, s.student_password_hash));

  if (!match) {
    return res.render('student_manage_login', { assignment, error: '이름 또는 비밀번호가 일치하는 제출물이 없습니다.' });
  }

  markVerified(req, match.id);
  res.redirect(`/assignments/${assignment.id}/manage/${match.id}`);
});

// 2) 확인된 세션에서만 제출물 상세 조회/재제출/삭제 가능
router.get('/assignments/:id/manage/:submissionId', (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ? AND assignment_id = ?')
    .get(req.params.submissionId, req.params.id);
  if (!assignment || !submission) return res.status(404).send('찾을 수 없습니다.');
  if (!isVerified(req, submission.id)) {
    return res.redirect(`/assignments/${assignment.id}/manage`);
  }
  res.render('student_manage_detail', { assignment, submission, error: null });
});

router.post('/assignments/:id/manage/:submissionId/resubmit', (req, res, next) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ? AND assignment_id = ?')
    .get(req.params.submissionId, req.params.id);
  if (!assignment || !submission) return res.status(404).send('찾을 수 없습니다.');
  if (!isVerified(req, submission.id)) return res.redirect(`/assignments/${assignment.id}/manage`);

  upload.single('file')(req, res, (err) => {
    if (err) return res.render('student_manage_detail', { assignment, submission, error: err.message });
    next();
  });
}, (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ? AND assignment_id = ?')
    .get(req.params.submissionId, req.params.id);

  if (!req.file) {
    return res.render('student_manage_detail', { assignment, submission, error: '새 파일을 선택해주세요.' });
  }

  const oldStoredFilename = submission.stored_filename;
  db.prepare(`
    UPDATE submissions
    SET original_filename = ?, stored_filename = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(req.file.originalname, req.file.filename, submission.id);

  deleteFile(oldStoredFilename);

  const updated = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submission.id);
  res.render('student_manage_detail', { assignment, submission: updated, error: null, justUpdated: true });
});

router.post('/assignments/:id/manage/:submissionId/delete', (req, res) => {
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ? AND assignment_id = ?')
    .get(req.params.submissionId, req.params.id);
  if (!submission) return res.status(404).send('찾을 수 없습니다.');
  if (!isVerified(req, submission.id)) return res.redirect(`/assignments/${req.params.id}/manage`);

  deleteFile(submission.stored_filename);
  db.prepare('DELETE FROM submissions WHERE id = ?').run(submission.id);
  if (req.session.verifiedSubmissions) delete req.session.verifiedSubmissions[submission.id];

  res.redirect('/');
});

module.exports = router;
