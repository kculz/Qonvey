// File Upload Service
// Location: backend/src/services/upload.service.ts

import { v2 as cloudinary } from 'cloudinary';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import path from 'path';
import type { UploadResult } from '@/types/upload.types';

let uuidv4: any = null;

// Optional AWS S3 imports
let S3Client: any = null;
let PutObjectCommand: any = null;
let DeleteObjectCommand: any = null;

try {
  if (config.storage.aws.enabled) {
    const awsSdk = require('@aws-sdk/client-s3');
    S3Client = awsSdk.S3Client;
    PutObjectCommand = awsSdk.PutObjectCommand;
    DeleteObjectCommand = awsSdk.DeleteObjectCommand;
  }
} catch (error) {
  loggers.info('AWS S3 SDK not available. AWS storage will be disabled.');
}

// Initialize uuid dynamically
(async () => {
  const uuidModule = await import('uuid');
  uuidv4 = uuidModule.v4;
})();

// Configure Cloudinary
if (config.storage.cloudinary.enabled) {
  cloudinary.config({
    cloud_name: config.storage.cloudinary.cloudName,
    api_key: config.storage.cloudinary.apiKey,
    api_secret: config.storage.cloudinary.apiSecret,
  });
}

// Configure AWS S3
let s3Client: any = null;
if (config.storage.aws.enabled && S3Client) {
  try {
    s3Client = new S3Client({
      region: config.storage.aws.region,
      credentials: {
        accessKeyId: config.storage.aws.accessKeyId,
        secretAccessKey: config.storage.aws.secretAccessKey,
      },
    });
  } catch (error) {
    loggers.info('Failed to initialize AWS S3 client', error);
  }
}

class UploadService {
  // ============================================
  // UPLOAD METHODS
  // ============================================

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'general'
  ): Promise<UploadResult> {
    try {
      // Use Cloudinary if available
      if (config.storage.cloudinary.enabled) {
        return await this.uploadToCloudinary(file, folder, 'image');
      }

      // Use AWS S3 if available
      if (config.storage.aws.enabled) {
        return await this.uploadToS3(file, folder);
      }

      // Fallback to local storage (not recommended for production)
      throw new Error('No storage provider configured');
    } catch (error: any) {
      loggers.error('Image upload failed', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async uploadDocument(
    file: Express.Multer.File,
    folder: string = 'documents'
  ): Promise<UploadResult> {
    try {
      // Use Cloudinary if available
      if (config.storage.cloudinary.enabled) {
        return await this.uploadToCloudinary(file, folder, 'raw');
      }

      // Use AWS S3 if available
      if (config.storage.aws.enabled) {
        return await this.uploadToS3(file, folder);
      }

      throw new Error('No storage provider configured');
    } catch (error: any) {
      loggers.error('Document upload failed', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    folder: string = 'general'
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map((file) => this.uploadImage(file, folder));
    return await Promise.all(uploadPromises);
  }

  // ============================================
  // CLOUDINARY METHODS
  // ============================================

  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
    resourceType: 'image' | 'raw' = 'image'
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: `qonvey/${folder}`,
        resource_type: resourceType,
        public_id: `${uuidv4()}-${Date.now()}`,
        transformation: resourceType === 'image' ? [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ] : undefined,
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              provider: 'cloudinary',
            });
          }
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteFromCloudinary(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      loggers.info('File deleted from Cloudinary', { publicId });
    } catch (error: any) {
      loggers.error('Cloudinary deletion failed', error);
      throw error;
    }
  }

  // ============================================
  // AWS S3 METHODS
  // ============================================

  private async uploadToS3(
    file: Express.Multer.File,
    folder: string
  ): Promise<UploadResult> {
    if (!s3Client || !PutObjectCommand) {
      throw new Error('S3 client not configured');
    }

    const fileExtension = path.extname(file.originalname);
    const key = `${folder}/${uuidv4()}-${Date.now()}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: config.storage.aws.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    });

    try {
      await s3Client.send(command);

      const url = `https://${config.storage.aws.bucket}.s3.${config.storage.aws.region}.amazonaws.com/${key}`;

      return {
        url,
        key,
        provider: 'aws',
      };
    } catch (error: any) {
      loggers.error('S3 upload failed', error);
      throw error;
    }
  }

  async deleteFromS3(key: string): Promise<void> {
    if (!s3Client || !DeleteObjectCommand) {
      throw new Error('S3 client not configured');
    }

    const command = new DeleteObjectCommand({
      Bucket: config.storage.aws.bucket,
      Key: key,
    });

    try {
      await s3Client.send(command);
      loggers.info('File deleted from S3', { key });
    } catch (error: any) {
      loggers.error('S3 deletion failed', error);
      throw error;
    }
  }

  // ============================================
  // DELETE METHODS
  // ============================================

  async deleteFile(url: string, publicId?: string, key?: string): Promise<void> {
    try {
      if (config.storage.cloudinary.enabled && publicId) {
        await this.deleteFromCloudinary(publicId);
      } else if (config.storage.aws.enabled && key) {
        await this.deleteFromS3(key);
      }
    } catch (error: any) {
      loggers.error('File deletion failed', error);
      // Don't throw - deletion failures shouldn't break the app
    }
  }

  // ============================================
  // VALIDATION
  // ============================================

  validateImageFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size exceeds 5MB limit.',
      };
    }

    return { valid: true };
  }

  validateDocumentFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Invalid file type. Only PDF, Word, and Excel documents are allowed.',
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size exceeds 10MB limit.',
      };
    }

    return { valid: true };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getStorageProvider(): 'cloudinary' | 'aws' | 'none' {
    if (config.storage.cloudinary.enabled) return 'cloudinary';
    if (config.storage.aws.enabled) return 'aws';
    return 'none';
  }

  isStorageConfigured(): boolean {
    return config.storage.cloudinary.enabled || config.storage.aws.enabled;
  }
}

export const uploadService = new UploadService();