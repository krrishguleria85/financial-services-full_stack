import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { config } from '../config';

export interface UploadDocumentParams {
  localFilePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  serviceRequestId: string;
  documentType: string;
}

export interface UploadResult {
  storedName: string;
  storageProvider: 'r2' | 'local';
}

export interface DocumentStreamResult {
  stream: NodeJS.ReadableStream;
  source: 'r2' | 'local';
  contentLength?: number;
  contentType?: string;
}

export interface StorageMock {
  upload?: (params: {
    bucket: string;
    key: string;
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
    contentLength: number;
  }) => Promise<void>;
  download?: (params: {
    bucket: string;
    key: string;
  }) => Promise<{
    stream: NodeJS.ReadableStream;
    contentLength?: number;
    contentType?: string;
  } | null>;
  delete?: (params: {
    bucket: string;
    key: string;
  }) => Promise<void>;
}

let mockStorage: StorageMock | null = null;
let s3ClientInstance: S3Client | null = null;

/**
 * Configure an optional mock storage driver for unit and integration testing.
 * Prohibited in production.
 */
export function setMockStorage(mock: StorageMock | null, nodeEnv = config.nodeEnv): void {
  if (nodeEnv === 'production') {
    throw new Error('FATAL: setMockStorage cannot be used in production.');
  }
  mockStorage = mock;
}

/**
 * Retrieves or initializes the singleton S3 client for Cloudflare R2.
 */
export function getS3Client(): S3Client | null {
  if (s3ClientInstance) return s3ClientInstance;
  if (!config.r2.isConfigured) return null;

  s3ClientInstance = new S3Client({
    region: 'auto',
    endpoint: config.r2.endpoint,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });

  return s3ClientInstance;
}

/**
 * Check if Cloudflare R2 is configured and active (or active mock).
 */
export function isR2Configured(): boolean {
  if (mockStorage) return true;
  return config.r2.isConfigured;
}

/**
 * Checks whether a storedName represents an R2 object key.
 */
export function isR2ObjectKey(storedName: string): boolean {
  if (!storedName) return false;
  return (
    storedName.startsWith('r2:') ||
    storedName.startsWith('documents/') ||
    storedName.includes('/')
  );
}

/**
 * Normalizes storedName by removing any optional 'r2:' prefix.
 */
export function normalizeR2Key(storedName: string): string {
  if (storedName.startsWith('r2:')) {
    return storedName.slice(3);
  }
  return storedName;
}

/**
 * Builds the canonical R2 object key: documents/<serviceRequestId>/<filename>
 */
export function buildR2ObjectKey(serviceRequestId: string, filename: string): string {
  const safeFilename = path.basename(filename);
  return `documents/${serviceRequestId}/${safeFilename}`;
}

/**
 * Uploads a validated document to Cloudflare R2 private bucket.
 * If R2 is not configured, safely falls back to local disk storage.
 */
export async function uploadDocumentFile(params: UploadDocumentParams): Promise<UploadResult> {
  const filename = path.basename(params.localFilePath);

  if (isR2Configured()) {
    const objectKey = buildR2ObjectKey(params.serviceRequestId, filename);

    if (mockStorage?.upload) {
      const fileBuffer = fs.readFileSync(params.localFilePath);
      await mockStorage.upload({
        bucket: config.r2.bucketName,
        key: objectKey,
        body: fileBuffer,
        contentType: params.mimeType,
        contentLength: params.size,
      });
      return { storedName: objectKey, storageProvider: 'r2' };
    }

    const client = getS3Client();
    if (!client) {
      throw new Error('Cloudflare R2 is configured but S3 client failed to initialize.');
    }

    const fileStream = fs.createReadStream(params.localFilePath);
    const safeOriginalName = encodeURIComponent(path.basename(params.originalName));

    const command = new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: objectKey,
      Body: fileStream,
      ContentType: params.mimeType,
      ContentLength: params.size,
      Metadata: {
        originalname: safeOriginalName,
        documenttype: encodeURIComponent(params.documentType),
        servicerequestid: params.serviceRequestId,
      },
    });

    await client.send(command);
    return { storedName: objectKey, storageProvider: 'r2' };
  }

  // Fallback to local storage (file is already at params.localFilePath)
  return { storedName: filename, storageProvider: 'local' };
}

/**
 * Streams an authorized document from Cloudflare R2 or local disk.
 * Supports legacy local documents seamlessly.
 */
export async function getDocumentStream(storedName: string): Promise<DocumentStreamResult | null> {
  const isR2 = isR2ObjectKey(storedName);
  const normalizedKey = normalizeR2Key(storedName);

  // 1. If stored in R2 or if R2 is configured and key might be in R2
  if (isR2 || isR2Configured()) {
    if (mockStorage?.download) {
      const mockResult = await mockStorage.download({
        bucket: config.r2.bucketName,
        key: normalizedKey,
      });
      if (mockResult) {
        return {
          stream: mockResult.stream,
          source: 'r2',
          contentLength: mockResult.contentLength,
          contentType: mockResult.contentType,
        };
      }
    } else {
      const client = getS3Client();
      if (client) {
        try {
          const command = new GetObjectCommand({
            Bucket: config.r2.bucketName,
            Key: normalizedKey,
          });
          const response = await client.send(command);
          if (response.Body) {
            return {
              stream: response.Body as NodeJS.ReadableStream,
              source: 'r2',
              contentLength: response.ContentLength,
              contentType: response.ContentType,
            };
          }
        } catch (s3Error: any) {
          // If not found in R2 and not explicitly an R2 path, fall through to check local disk
          if (s3Error.name !== 'NoSuchKey' && s3Error.$metadata?.httpStatusCode !== 404) {
            // Re-throw genuine network or credential errors
            if (isR2) throw s3Error;
          }
        }
      }
    }
  }

  // 2. Check local disk for legacy or fallback documents
  const localFilename = path.basename(storedName);
  const localPath = path.join(config.upload.dir, localFilename);
  if (fs.existsSync(localPath)) {
    try {
      const stats = fs.statSync(localPath);
      const stream = fs.createReadStream(localPath);
      return {
        stream,
        source: 'local',
        contentLength: stats.size,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export interface DeletionResult {
  success: boolean;
  key: string;
  source: 'r2' | 'local';
  error?: string;
}

/**
 * Deletes a document file from R2 and/or local storage.
 * Operations are idempotent and fault-tolerant: R2 or filesystem errors do not throw
 * unhandled exceptions, preserving database transactions and preventing data corruption.
 * Failed deletions are logged with observable tags without exposing sensitive customer data or credentials.
 */
export async function deleteDocumentFile(storedName: string): Promise<DeletionResult> {
  const isR2 = isR2ObjectKey(storedName);
  const normalizedKey = normalizeR2Key(storedName);
  let r2Success = true;
  let r2Error: string | undefined;

  // 1. Delete from R2
  if (isR2 || isR2Configured()) {
    if (mockStorage?.delete) {
      try {
        await mockStorage.delete({
          bucket: config.r2.bucketName,
          key: normalizedKey,
        });
      } catch (err: any) {
        r2Success = false;
        r2Error = err?.message || 'Mock R2 deletion error';
        console.error(`[STORAGE_DELETION_FAILED] bucket="${config.r2.bucketName}" key="${normalizedKey}" reason="${err?.name || 'MockDeleteError'}" error="${r2Error}"`);
      }
    } else {
      const client = getS3Client();
      if (client) {
        try {
          const command = new DeleteObjectCommand({
            Bucket: config.r2.bucketName,
            Key: normalizedKey,
          });
          await client.send(command);
        } catch (err: any) {
          r2Success = false;
          r2Error = err?.message ? String(err.message).slice(0, 200) : (err?.name || 'Unknown R2 deletion error');
          console.error(`[STORAGE_DELETION_FAILED] bucket="${config.r2.bucketName}" key="${normalizedKey}" reason="${err?.name || 'R2DeleteError'}" error="${r2Error}"`);
        }
      }
    }
  }

  // 2. Also clean up local file if it exists on disk
  const localFilename = path.basename(storedName);
  const localPath = path.join(config.upload.dir, localFilename);
  let localSuccess = true;
  if (fs.existsSync(localPath)) {
    try {
      fs.unlinkSync(localPath);
    } catch (err: any) {
      localSuccess = false;
      console.error(`[LOCAL_STORAGE_DELETION_FAILED] file="${localFilename}" error="${err?.message || 'Unlink error'}"`);
    }
  }

  return {
    success: r2Success && localSuccess,
    key: normalizedKey,
    source: isR2 ? 'r2' : 'local',
    error: r2Error,
  };
}

/**
 * Deletes an R2 object directly (used for cleaning up orphaned R2 objects on database failure).
 * Does not rethrow network errors to ensure calling error-handling paths are not disrupted.
 * Failed cleanup is logged with [ORPHAN_CLEANUP_FAILED] for observability without leaking secrets or PII.
 */
export async function deleteOrphanedR2Object(objectKey: string): Promise<boolean> {
  const normalizedKey = normalizeR2Key(objectKey);
  try {
    if (mockStorage?.delete) {
      await mockStorage.delete({
        bucket: config.r2.bucketName,
        key: normalizedKey,
      });
      return true;
    }

    const client = getS3Client();
    if (client) {
      const command = new DeleteObjectCommand({
        Bucket: config.r2.bucketName,
        Key: normalizedKey,
      });
      await client.send(command);
      return true;
    }
    return false;
  } catch (err: any) {
    const errorReason = err?.name || 'R2OrphanCleanupError';
    const errorMessage = err?.message ? String(err.message).slice(0, 200) : 'Unknown cleanup error';
    console.error(`[ORPHAN_CLEANUP_FAILED] bucket="${config.r2.bucketName}" key="${normalizedKey}" reason="${errorReason}" error="${errorMessage}"`);
    return false;
  }
}
