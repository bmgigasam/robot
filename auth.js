// routes/auth.js - 교사 로그인/로그아웃
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { redirectIfLoggedIn } = require('../middleware/auth');

const router = express.Router();

// 로그인 시도 횟수 제한 (간단한 메모리 기반 rate limit, 무차별 대입 공격 방지용)
const loginAttempts = new Map(); // key: ip, value: { count, firstAttempt }
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000; // 10분

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAttempt: Date.now() });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('teacher_login', { error: req.query.error });
});

router.post('/login', redirectIfLoggedIn, (req, res) => {
  const ip = req.ip;
  const { username, password } = req.body;

  if (isRateLimited(ip)) {
    return res.render('teacher_login', { error: 'too_many_attempts' });
  }

  if (!username || !password) {
    return res.render('teacher_login', { error: 'missing_fields' });
  }

  const teacher = db.prepare('SELECT * FROM teachers WHERE username = ?').get(username);

  if (!teacher) {
    recordFailedAttempt(ip);
    return res.render('teacher_login', { error: 'invalid_credentials' });
  }

  const ok = bcrypt.compareSync(password, teacher.password_hash);
  if (!ok) {
    recordFailedAttempt(ip);
    return res.render('teacher_login', { error: 'invalid_credentials' });
  }

  clearAttempts(ip);

  // 세션 고정 공격 방지를 위해 로그인 시 세션 재생성
  req.session.regenerate((err) => {
    if (err) {
      return res.render('teacher_login', { error: 'server_error' });
    }
    req.session.teacherId = teacher.id;
    req.session.teacherUsername = teacher.username;
    res.redirect('/teacher/dashboard');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/teacher/login');
  });
});

module.exports = router;
