import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import fs from 'fs';

// Ensure upload directory exists
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

export type DetectedFileType = 'pdf' | 'jpeg' | 'png';

export interface FileTypeSpec {
  extensions: string[];
  mimeTypes: string[];
}

export const FILE_SPECS: Record<DetectedFileType, FileTypeSpec> = {
  pdf: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
  },
  jpeg: {
    extensions: ['.jpg', '.jpeg'],
    mimeTypes: ['image/jpeg'],
  },
  png: {
    extensions: ['.png'],
    mimeTypes: ['image/png'],
  },
};

export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
export const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

/**
 * Explicit allowlist of service request statuses permitted to accept customer document uploads.
 * Terminal/inactive statuses (COMPLETED, CANCELLED) or unknown statuses are strictly rejected.
 */
export const UPLOAD_ELIGIBLE_STATUSES = new Set([
  'NEW',
  'DOCUMENTS_REQUIRED',
  'DOCUMENTS_RECEIVED',
  'UNDER_REVIEW',
  'IN_PROGRESS',
]);

/**
 * Checks whether detected binary magic bytes match the claimed extension and MIME type.
 */
export function isSignatureMatchingExtensionAndMime(
  detectedType: DetectedFileType,
  extension: string,
  mimeType: string
): boolean {
  const spec = FILE_SPECS[detectedType];
  if (!spec) return false;
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();
  return spec.extensions.includes(ext) && spec.mimeTypes.includes(mime);
}

let multerStorageInvocations = 0;

export function getMulterStorageInvocations(): number {
  return multerStorageInvocations;
}

export function resetMulterStorageInvocations(): void {
  multerStorageInvocations = 0;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (req: any, file, cb) => {
    multerStorageInvocations++;
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    const targetPath = path.join(config.upload.dir, uniqueName);
    // Track target file path on req so cleanup logic can reliably unlink it even if req.file is never populated
    req._multerPendingFilePath = targetPath;
    cb(null, uniqueName);
  },
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new Error('Invalid file extension. Allowed extensions: PDF, JPG, JPEG, PNG'));
    return;
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    cb(new Error('Invalid MIME type. Allowed types: PDF, JPG, JPEG, PNG'));
    return;
  }
  const isMimeCompatible = Object.values(FILE_SPECS).some(
    (spec) => spec.extensions.includes(ext) && spec.mimeTypes.includes(file.mimetype.toLowerCase())
  );
  if (!isMimeCompatible) {
    cb(new Error(`Declared MIME type ${file.mimetype} does not match file extension ${ext}`));
    return;
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
  },
});

/**
 * Express middleware wrapper around multer.single().
 * Intercepts any Multer error (such as LIMIT_FILE_SIZE or fileFilter rejections)
 * and guarantees that any pending or partially streamed file on disk is immediately unlinked.
 */
export const uploadSingleFile = (fieldName: string) => {
  const multerHandler = upload.single(fieldName);
  return (req: any, res: any, next: any) => {
    multerHandler(req, res, (err: any) => {
      if (err) {
        const pendingPath = req._multerPendingFilePath;
        if (pendingPath && fs.existsSync(pendingPath)) {
          try {
            fs.unlinkSync(pendingPath);
          } catch {
            // Ignore unlink errors
          }
        }
        if (req.file?.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch {
            // Ignore unlink errors
          }
        }
        return next(err);
      }
      next();
    });
  };
};

/**
 * Inspects binary magic bytes on disk to confirm file contents match allowed signatures.
 */
export function validateFileMagicBytes(filePath: string): { valid: boolean; detected?: DetectedFileType } {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) {
      return { valid: false };
    }

    // PDF: starts with %PDF- (0x25 0x50 0x44 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { valid: true, detected: 'pdf' };
    }

    // JPEG: starts with FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, detected: 'jpeg' };
    }

    // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    if (
      bytesRead >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { valid: true, detected: 'png' };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * Dedicated upload rate limiter (max 10 upload attempts per 15 min per IP)
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload attempts. Please try again after 15 minutes.' },
});

