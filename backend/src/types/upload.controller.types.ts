// backend/src/types/upload.controller.types.ts

export interface UploadImageRequest {
  file: Express.Multer.File;
  body: {
    subfolder?: string;
  };
}

export interface UploadDocumentRequest {
  file: Express.Multer.File;
  body: {
    subfolder?: string;
  };
}

export interface UploadVehicleImageRequest {
  file: Express.Multer.File;
  body: {
    vehicleId: string;
    imageType?: 'exterior' | 'interior' | 'documents';
  };
}

export interface UploadMultipleRequest {
  files: Express.Multer.File[];
  body: {
    type?: 'images' | 'documents';
    subfolder?: string;
  };
}

export interface DeleteFileRequest {
  body: {
    url?: string;
    publicId?: string;
    key?: string;
    localPath?: string;
  };
}

export interface CopyFileRequest {
  body: {
    sourceUrl: string;
    destinationCategory: 'images' | 'documents' | 'vehicle' | 'profile';
  };
}

export interface CleanupTempFilesRequest {
  body: {
    maxAgeHours?: number;
  };
}

export interface FileInfoRequest {
  query: {
    url: string;
  };
}