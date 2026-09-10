// middleware/auth.js
// 교사 전용 페이지를 보호하는 미들웨어.
// 세션에 teacherId가 없으면(=로그인하지 않았으면) 로그인 페이지로 리다이렉트한다.
// 학생은 이 라우트들에 절대 접근할 수 없고, 오직 올바른 비밀번호로 로그인한 세션만 통과한다.

function requireTeacherLogin(req, res, next) {
  if (req.session && req.session.teacherId) {
    return next();
  }
  return res.redirect('/teacher/login?error=login_required');
}

// 이미 로그인한 교사가 로그인 페이지에 다시 접근하면 대시보드로 보냄
function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.teacherId) {
    return res.redirect('/teacher/dashboard');
  }
  return next();
}

module.exports = { requireTeacherLogin, redirectIfLoggedIn };
