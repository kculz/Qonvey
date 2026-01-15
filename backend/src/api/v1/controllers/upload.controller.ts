// File Upload Controller - Updated for Local Storage
// Location: backend/src/api/v1/controllers/upload.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { uploadService } from '@/services/upload.service';
import config from '@/config/env';

export const uploadImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Validate file
    const validation = uploadService.validateImageFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const { subfolder = 'general' } = req.body;
    const result = await uploadService.uploadImage(req.file, subfolder);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Validate file
    const validation = uploadService.validateDocumentFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const { subfolder = 'general' } = req.body;
    const result = await uploadService.uploadDocument(req.file, subfolder);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadProfileImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate file
    const validation = uploadService.validateImageFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const result = await uploadService.uploadProfileImage(req.file, req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadVehicleImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { vehicleId, imageType = 'exterior' } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID is required',
      });
    }

    if (!['exterior', 'interior', 'documents'].includes(imageType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image type. Must be: exterior, interior, or documents',
      });
    }

    // Validate file
    const validation = uploadService.validateImageFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const result = await uploadService.uploadVehicleImage(
      req.file,
      vehicleId,
      imageType as 'exterior' | 'interior' | 'documents'
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadMultiple = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const { type = 'images', subfolder = 'general' } = req.body;

    if (!['images', 'documents'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be: images or documents',
      });
    }

    // Validate all files
    for (const file of req.files) {
      const validation = type === 'images' 
        ? uploadService.validateImageFile(file)
        : uploadService.validateDocumentFile(file);
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname}: ${validation.error}`,
        });
      }
    }

    const results = await uploadService.uploadMultiple(
      req.files as Express.Multer.File[],
      type as 'images' | 'documents',
      subfolder
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteFile = async (req: AuthRequest, res: Response) => {
  try {
    const { url, publicId, key, localPath } = req.body;

    if (!url && !localPath) {
      return res.status(400).json({
        success: false,
        message: 'File URL or local path is required',
      });
    }

    // Create upload result object based on provided data
    const uploadResult = {
      url: url || '',
      provider: 'local' as const,
      ...(publicId && { publicId }),
      ...(key && { key }),
      ...(localPath && { localPath }),
    };

    await uploadService.deleteFile(uploadResult);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteFileByUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'File URL is required',
      });
    }

    // Convert URL to local path if it's a local upload
    if (url.startsWith('/uploads/')) {
      try {
        const localPath = uploadService.getLocalFilePath(url);
        const uploadResult = {
          url,
          provider: 'local' as const,
          localPath,
        };
        await uploadService.deleteFile(uploadResult);
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          message: 'Invalid upload URL or file not found',
        });
      }
    } else {
      // For cloud storage, we need publicId or key
      const { publicId, key } = req.body;
      
      if (!publicId && !key) {
        return res.status(400).json({
          success: false,
          message: 'publicId or key is required for cloud storage files',
        });
      }

      const uploadResult = {
        url,
        provider: uploadService.getStorageProvider() as 'cloudinary' | 'aws',
        ...(publicId && { publicId }),
        ...(key && { key }),
      };

      await uploadService.deleteFile(uploadResult);
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getStorageInfo = async (req: AuthRequest, res: Response) => {
  try {
    const provider = uploadService.getStorageProvider();
    const isConfigured = uploadService.isStorageConfigured();

    res.json({
      success: true,
      data: {
        provider,
        isConfigured,
        supports: {
          cloudinary: config.storage.cloudinary.enabled,
          aws: config.storage.aws.enabled,
          local: true,
        },
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getFileInfo = async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'File URL is required',
      });
    }

    // Check if it's a local file
    if (url.startsWith('/uploads/')) {
      try {
        const localPath = uploadService.getLocalFilePath(url);
        const stats = await uploadService.getFileStats(localPath);

        if (!stats.exists) {
          return res.status(404).json({
            success: false,
            message: 'File not found',
          });
        }

        res.json({
          success: true,
          data: {
            url,
            localPath,
            exists: stats.exists,
            size: stats.size,
            modified: stats.modified,
            isDirectory: stats.isDirectory,
          },
        });
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          message: 'Invalid upload URL',
        });
      }
    } else {
      // For cloud storage, we can only provide basic info
      res.json({
        success: true,
        data: {
          url,
          exists: true, // Assume exists if we have a URL
          provider: uploadService.getStorageProvider(),
        },
      });
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const copyFile = async (req: AuthRequest, res: Response) => {
  try {
    const { sourceUrl, destinationCategory } = req.body;

    if (!sourceUrl || !destinationCategory) {
      return res.status(400).json({
        success: false,
        message: 'Source URL and destination category are required',
      });
    }

    if (!['images', 'documents', 'vehicle', 'profile'].includes(destinationCategory)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid destination category',
      });
    }

    // Get local path from URL
    if (!sourceUrl.startsWith('/uploads/')) {
      return res.status(400).json({
        success: false,
        message: 'Only local files can be copied',
      });
    }

    const sourcePath = uploadService.getLocalFilePath(sourceUrl);
    const newUrl = await uploadService.copyFile(sourcePath, destinationCategory as any);

    res.json({
      success: true,
      data: {
        originalUrl: sourceUrl,
        newUrl,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Admin endpoints
export const cleanupTempFiles = async (req: AuthRequest, res: Response) => {
  try {
    const { maxAgeHours = 24 } = req.body;
    const deletedCount = await uploadService.cleanupTempFiles(maxAgeHours);

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `Cleaned up ${deletedCount} temporary files`,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getStorageStats = async (req: AuthRequest, res: Response) => {
  try {
    const fs = require('fs/promises');
    const path = require('path');
    const UPLOADS_BASE_DIR = path.join(process.cwd(), 'uploads');

    const getDirectorySize = async (dirPath: string): Promise<number> => {
      try {
        const files = await fs.readdir(dirPath);
        let totalSize = 0;

        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);

          if (stats.isDirectory()) {
            totalSize += await getDirectorySize(filePath);
          } else {
            totalSize += stats.size;
          }
        }

        return totalSize;
      } catch (error) {
        return 0;
      }
    };

    const stats = {
      totalSize: await getDirectorySize(UPLOADS_BASE_DIR),
      byCategory: {} as Record<string, number>,
      fileCount: 0,
    };

    // Calculate size for each category
    for (const [category, dirPath] of Object.entries({
      images: path.join(UPLOADS_BASE_DIR, 'images'),
      documents: path.join(UPLOADS_BASE_DIR, 'documents'),
      vehicle: path.join(UPLOADS_BASE_DIR, 'vehicle'),
      profile: path.join(UPLOADS_BASE_DIR, 'profile'),
      temp: path.join(UPLOADS_BASE_DIR, 'temp'),
    })) {
      stats.byCategory[category] = await getDirectorySize(dirPath);
    }

    // Format sizes for display
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    res.json({
      success: true,
      data: {
        ...stats,
        formatted: {
          totalSize: formatBytes(stats.totalSize),
          byCategory: Object.fromEntries(
            Object.entries(stats.byCategory).map(([cat, size]) => [cat, formatBytes(size)])
          ),
        },
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};