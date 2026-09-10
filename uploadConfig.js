// uploadConfig.js - multer 설정
// 업로드된 파일은 public 폴더가 아닌 uploads/ 에 저장하여
// 교사 인증 없이는 직접 URL로 접근할 수 없게 한다.
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 허용할 확장자 (필요에 따라 조정)
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.hwp', '.hwpx', '.ppt', '.pptx',
  '.xls', '.xlsx', '.txt', '.zip', '.png', '.jpg', '.jpeg', '.gif'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error('허용되지 않는 파일 형식입니다.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB 제한
});

module.exports = upload;
