// Request Validation Middleware
// Location: backend/src/middleware/validation.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};

// Common validation schemas
export const schemas = {
  // Auth schemas
  register: z.object({
    body: z.object({
      phoneNumber: z.string().min(10, 'Phone number is required'),
      email: z.string().email('Invalid email').optional(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      firstName: z.string().min(1, 'First name is required'),
      lastName: z.string().min(1, 'Last name is required'),
      role: z.enum(['CARGO_OWNER', 'DRIVER', 'FLEET_OWNER']),
      companyName: z.string().optional(),
      companyRegistration: z.string().optional(),
      driversLicense: z.string().optional(),
      idDocument: z.string().optional(),
    }),
  }),

  login: z.object({
    body: z.object({
      email: z.string().min(1, 'Email or phone is required'),
      password: z.string().min(1, 'Password is required'),
    }),
  }),

  // Load schemas
  createLoad: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().min(10, 'Description must be at least 10 characters'),
      cargoType: z.string().min(1, 'Cargo type is required'),
      weight: z.number().positive('Weight must be positive'),
      volume: z.number().positive().optional(),
      pickupLocation: z.object({
        address: z.string(),
        lat: z.number(),
        lng: z.number(),
        city: z.string(),
        province: z.string().optional(),
      }),
      deliveryLocation: z.object({
        address: z.string(),
        lat: z.number(),
        lng: z.number(),
        city: z.string(),
        province: z.string().optional(),
      }),
      pickupDate: z.string().transform((val) => new Date(val)),
      deliveryDate: z.string().transform((val) => new Date(val)).optional(),
      suggestedPrice: z.number().positive().optional(),
      currency: z.string().default('USD'),
      vehicleTypes: z.array(z.enum(['PICKUP', 'SMALL_TRUCK', 'MEDIUM_TRUCK', 'LARGE_TRUCK', 'FLATBED', 'REFRIGERATED', 'CONTAINER'])),
      images: z.array(z.string()).optional(),
      documents: z.array(z.string()).optional(),
      requiresInsurance: z.boolean().default(false),
      fragile: z.boolean().default(false),
      expiresAt: z.string().transform((val) => new Date(val)).optional(),
    }),
  }),

  // Bid schemas
  createBid: z.object({
    body: z.object({
      loadId: z.string().uuid('Invalid load ID'),
      proposedPrice: z.number().positive('Price must be positive'),
      currency: z.string().default('USD'),
      message: z.string().optional(),
      estimatedDuration: z.number().positive().optional(),
      vehicleId: z.string().uuid().optional(),
      expiresAt: z.string().transform((val) => new Date(val)).optional(),
    }),
  }),

  // Vehicle schemas
  createVehicle: z.object({
    body: z.object({
      type: z.enum(['PICKUP', 'SMALL_TRUCK', 'MEDIUM_TRUCK', 'LARGE_TRUCK', 'FLATBED', 'REFRIGERATED', 'CONTAINER']),
      make: z.string().min(1, 'Make is required'),
      model: z.string().min(1, 'Model is required'),
      year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
      licensePlate: z.string().min(1, 'License plate is required'),
      color: z.string().optional(),
      capacity: z.number().positive('Capacity must be positive'),
      volumeCapacity: z.number().positive().optional(),
      images: z.array(z.string()).optional(),
      insurance: z.string().optional(),
      registration: z.string().optional(),
    }),
  }),

  // Review schemas
  createReview: z.object({
    body: z.object({
      tripId: z.string().uuid('Invalid trip ID'),
      rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
      comment: z.string().optional(),
    }),
  }),

  // OTP schemas
  verifyOTP: z.object({
    body: z.object({
      phoneNumber: z.string().min(10, 'Phone number is required'),
      otp: z.string().length(6, 'OTP must be 6 digits'),
    }),
  }),

  // Payment schemas
  initiatePayment: z.object({
    body: z.object({
      plan: z.enum(['STARTER', 'PROFESSIONAL', 'BUSINESS']),
      method: z.enum(['ECOCASH', 'ONEMONEY', 'CARD', 'BANK_TRANSFER']),
    }),
  }),
};

export default validate;