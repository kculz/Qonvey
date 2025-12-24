export interface UploadResult {
  url: string;
  publicId?: string;
  key?: string;
  secureUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  provider?: 'cloudinary' | 'aws' | 'local';
}

export interface UploadOptions {
  folder?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: any;
}

