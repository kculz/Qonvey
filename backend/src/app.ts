// Express Application
// Location: backend/src/app.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from '@/config/env';
import { morganStream } from '@/utils/logger';
import {versioningMiddleware} from '@/middleware/versioning.middleware';
import errorMiddleware from '@/middleware/error.middleware';
import { generalLimiter } from '@/middleware/rateLimiter.middleware';
import v1Routes from '@/api/v1';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Version'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', { stream: morganStream }));

// Versioning middleware
app.use(versioningMiddleware);

// Rate limiting
if (config.features.rateLimiting) {
  app.use(generalLimiter);
}

// API routes
app.use('/api/v1', v1Routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Qonvey API',
    version: config.apiVersion,
    environment: config.env,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

export default app;