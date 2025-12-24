// File Upload Controller
// Location: backend/src/api/v1/controllers/upload.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { uploadService } from '@/services/upload.service';

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

    const { folder = 'general' } = req.body;
    const result = await uploadService.uploadImage(req.file, folder);

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

    const { folder = 'documents' } = req.body;
    const result = await uploadService.uploadDocument(req.file, folder);

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

    // Validate all files
    for (const file of req.files) {
      const validation = uploadService.validateImageFile(file);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname}: ${validation.error}`,
        });
      }
    }

    const { folder = 'general' } = req.body;
    const results = await uploadService.uploadMultiple(req.files, folder);

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
    const { url, publicId, key } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'File URL is required',
      });
    }

    await uploadService.deleteFile(url, publicId, key);

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
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};