// db.js - SQLite 데이터베이스 설정
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'app.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// 교사 계정 테이블 (1명만 사용하지만 확장 가능하게 테이블로 관리)
db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// 과제(assignment) 테이블 - 교사가 과제를 등록하면 학생이 그 과제에 제출
db.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// 제출물(submission) 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    student_name TEXT NOT NULL,
    student_number TEXT,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    student_password_hash TEXT NOT NULL,
    comment TEXT,
    submitted_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
  );
`);

// 기존 DB 파일 호환을 위한 마이그레이션
const submissionColumns = db.prepare("PRAGMA table_info(submissions)").all().map(c => c.name);
if (!submissionColumns.includes('student_password_hash')) {
  db.exec("ALTER TABLE submissions ADD COLUMN student_password_hash TEXT NOT NULL DEFAULT ''");
}
if (!submissionColumns.includes('updated_at')) {
  db.exec("ALTER TABLE submissions ADD COLUMN updated_at TEXT");
}
if (!submissionColumns.includes('comment')) {
  db.exec("ALTER TABLE submissions ADD COLUMN comment TEXT");
}

module.exports = db;
