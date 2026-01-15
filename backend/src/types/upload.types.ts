// backend/src/types/upload.types.ts

export interface UploadResult {
  url: string;
  provider: 'cloudinary' | 'aws' | 'local';
  publicId?: string;
  key?: string;
  localPath?: string;
  fileName?: string;
  originalName?: string;
  thumbnailUrl?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  allowedTypes?: string[];
  maxSize?: number;
}

export interface FileStats {
  exists: boolean;
  size?: number;
  modified?: Date;
  isDirectory?: boolean;
  mimetype?: string;
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality?: number;
  format?: 'jpg' | 'png' | 'webp';
}

export interface UploadConfig {
  allowedImageTypes: string[];
  allowedDocumentTypes: string[];
  maxImageSize: number;
  maxDocumentSize: number;
  defaultImageQuality: number;
  defaultThumbnailSize: number;
}

export interface StorageProvider {
  name: string;
  enabled: boolean;
  config: any;
}