import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import versioningMiddleware from './middleware/versioning.middleware';
import errorMiddleware from './middleware/error.middleware';
import v1Routes from './api/v1';

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Versioning middleware
app.use(versioningMiddleware);

// API routes
app.use('/api', v1Routes);

// Error handling middleware
app.use(errorMiddleware);

export default app;