// File Upload Service with Local Storage Support
// Location: backend/src/services/upload.service.ts

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
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

// Base uploads directory
const UPLOADS_BASE_DIR = path.join(process.cwd(), 'uploads');

// Subdirectories for organized storage
const UPLOAD_DIRS = {
  images: path.join(UPLOADS_BASE_DIR, 'images'),
  documents: path.join(UPLOADS_BASE_DIR, 'documents'),
  vehicle: path.join(UPLOADS_BASE_DIR, 'vehicle'),
  profile: path.join(UPLOADS_BASE_DIR, 'profile'),
  temp: path.join(UPLOADS_BASE_DIR, 'temp'),
};

class UploadService {
  constructor() {
    this.initializeUploadDirectories();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  private async initializeUploadDirectories() {
    try {
      // Create all directories
      for (const dir of Object.values(UPLOAD_DIRS)) {
        if (!fsSync.existsSync(dir)) {
          await fs.mkdir(dir, { recursive: true });
          loggers.info(`Created upload directory: ${dir}`);
        }
      }
      loggers.info('Upload directories initialized');
    } catch (error) {
      loggers.error('Failed to initialize upload directories', error);
      throw new Error('Unable to initialize upload directories');
    }
  }

  // ============================================
  // UPLOAD METHODS
  // ============================================

  async uploadImage(
    file: Express.Multer.File,
    subfolder: string = 'general'
  ): Promise<UploadResult> {
    try {
      // Validate image
      const validation = this.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Choose storage provider based on configuration
      const storageProvider = this.getStorageProvider();

      switch (storageProvider) {
        case 'cloudinary':
          return await this.uploadToCloudinary(file, subfolder, 'image');
        case 'aws':
          return await this.uploadToS3(file, subfolder);
        case 'local':
        default:
          return await this.uploadToLocal(file, 'images', subfolder);
      }
    } catch (error: any) {
      loggers.error('Image upload failed', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async uploadDocument(
    file: Express.Multer.File,
    subfolder: string = 'general'
  ): Promise<UploadResult> {
    try {
      // Validate document
      const validation = this.validateDocumentFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Choose storage provider
      const storageProvider = this.getStorageProvider();

      switch (storageProvider) {
        case 'cloudinary':
          return await this.uploadToCloudinary(file, subfolder, 'raw');
        case 'aws':
          return await this.uploadToS3(file, subfolder);
        case 'local':
        default:
          return await this.uploadToLocal(file, 'documents', subfolder);
      }
    } catch (error: any) {
      loggers.error('Document upload failed', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async uploadProfileImage(
    file: Express.Multer.File,
    userId: string
  ): Promise<UploadResult> {
    try {
      const validation = this.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Always use local storage for profile images for immediate availability
      return await this.uploadToLocal(file, 'profile', `user_${userId}`);
    } catch (error: any) {
      loggers.error('Profile image upload failed', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async uploadVehicleImage(
    file: Express.Multer.File,
    vehicleId: string,
    imageType: 'exterior' | 'interior' | 'documents' = 'exterior'
  ): Promise<UploadResult> {
    try {
      const validation = this.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const subfolder = `${vehicleId}/${imageType}`;
      return await this.uploadToLocal(file, 'vehicle', subfolder);
    } catch (error: any) {
      loggers.error('Vehicle image upload failed', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    type: 'images' | 'documents' = 'images',
    subfolder: string = 'general'
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map((file) => {
      if (type === 'images') {
        return this.uploadImage(file, subfolder);
      } else {
        return this.uploadDocument(file, subfolder);
      }
    });
    return await Promise.all(uploadPromises);
  }

  // ============================================
  // LOCAL STORAGE METHODS
  // ============================================

  private async uploadToLocal(
    file: Express.Multer.File,
    category: keyof typeof UPLOAD_DIRS,
    subfolder: string = ''
  ): Promise<UploadResult> {
    // Ensure category directory exists
    const baseDir = UPLOAD_DIRS[category];
    
    // Create subfolder if provided
    let finalDir = baseDir;
    if (subfolder) {
      finalDir = path.join(baseDir, subfolder);
      await fs.mkdir(finalDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}-${Date.now()}${fileExtension}`;
    const filePath = path.join(finalDir, uniqueName);

    // Write file
    await fs.writeFile(filePath, file.buffer);

    // Generate URL path (relative to uploads base)
    const relativePath = path.relative(UPLOADS_BASE_DIR, filePath);
    const urlPath = `/uploads/${relativePath.replace(/\\/g, '/')}`;

    loggers.info('File uploaded locally', {
      category,
      subfolder,
      originalName: file.originalname,
      filePath,
      urlPath,
    });

    return {
      url: urlPath,
      localPath: filePath,
      provider: 'local',
      fileName: uniqueName,
      originalName: file.originalname,
    };
  }

  async deleteLocalFile(filePath: string): Promise<void> {
    try {
      // Ensure we're only deleting files within uploads directory
      const normalizedPath = path.normalize(filePath);
      if (!normalizedPath.startsWith(UPLOADS_BASE_DIR)) {
        throw new Error('Invalid file path: outside uploads directory');
      }

      if (fsSync.existsSync(normalizedPath)) {
        await fs.unlink(normalizedPath);
        loggers.info('Local file deleted', { filePath: normalizedPath });
      }
    } catch (error: any) {
      loggers.error('Local file deletion failed', error);
      throw error;
    }
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

  async deleteFile(result: UploadResult): Promise<void> {
    try {
      switch (result.provider) {
        case 'cloudinary':
          if ('publicId' in result && result.publicId) {
            await this.deleteFromCloudinary(result.publicId);
          }
          break;
        case 'aws':
          if ('key' in result && result.key) {
            await this.deleteFromS3(result.key);
          }
          break;
        case 'local':
          if ('localPath' in result && result.localPath) {
            await this.deleteLocalFile(result.localPath);
          }
          break;
        default:
          loggers.warn('Unknown storage provider', { provider: result.provider });
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
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.',
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
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Invalid file type. Only PDF, Word, Excel, JPEG, and PNG documents are allowed.',
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

  getStorageProvider(): 'cloudinary' | 'aws' | 'local' {
    if (config.storage.cloudinary.enabled) return 'cloudinary';
    if (config.storage.aws.enabled) return 'aws';
    return 'local'; // Default to local storage
  }

  isStorageConfigured(): boolean {
    return config.storage.cloudinary.enabled || config.storage.aws.enabled || true; // Local is always available
  }

  getFileUrl(localPath: string): string {
    // Convert local file path to URL path
    const relativePath = path.relative(UPLOADS_BASE_DIR, localPath);
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }

  getLocalFilePath(urlPath: string): string {
    // Convert URL path to local file path
    if (!urlPath.startsWith('/uploads/')) {
      throw new Error('Invalid URL path: must start with /uploads/');
    }
    const relativePath = urlPath.substring(9); // Remove '/uploads/'
    return path.join(UPLOADS_BASE_DIR, relativePath);
  }

  // ============================================
  // FILE MANAGEMENT
  // ============================================

  async getFileStats(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    modified?: Date;
    isDirectory?: boolean;
  }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      return { exists: false };
    }
  }

  async cleanupTempFiles(maxAgeHours: number = 24): Promise<number> {
    const tempDir = UPLOAD_DIRS.temp;
    let deletedCount = 0;

    try {
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);

        // Delete files older than maxAgeHours
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          deletedCount++;
          loggers.info('Cleaned up temp file', { filePath, ageHours: maxAgeHours });
        }
      }

      loggers.info('Temp files cleanup completed', { deletedCount });
      return deletedCount;
    } catch (error) {
      loggers.error('Temp files cleanup failed', error);
      return 0;
    }
  }

  async createThumbnail(
    sourcePath: string,
    options: { width: number; height: number; quality?: number }
  ): Promise<string> {
    // This would require an image processing library like sharp
    // For now, we'll return the original path
    // In production, implement with sharp or similar
    loggers.info('Thumbnail creation requested', { sourcePath, options });
    return sourcePath;
  }

  async copyFile(sourcePath: string, destinationCategory: keyof typeof UPLOAD_DIRS): Promise<string> {
    try {
      // Read source file
      const buffer = await fs.readFile(sourcePath);
      
      // Generate new filename
      const fileExtension = path.extname(sourcePath);
      const uniqueName = `${uuidv4()}-${Date.now()}${fileExtension}`;
      
      // Determine destination directory
      const destDir = UPLOAD_DIRS[destinationCategory];
      const destPath = path.join(destDir, uniqueName);
      
      // Write file
      await fs.writeFile(destPath, buffer);
      
      // Return URL path
      return this.getFileUrl(destPath);
    } catch (error: any) {
      loggers.error('File copy failed', error);
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  }
}

export const uploadService = new UploadService();