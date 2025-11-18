import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const UPLOAD_DIR = 'uploads/';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
// Cấu hình lưu trữ (destination và filename)
const storage = diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

export { storage, MAX_FILE_SIZE, CHUNK_SIZE, CHUNK_OVERLAP };