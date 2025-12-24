// Server Entry Point
// Location: backend/src/server.ts

import { createServer } from 'http';
import app from '@/app';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import { socketService } from '@/services/socket.service';
import prisma from '@/config/database';

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    loggers.info('✅ Database connected successfully');

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    if (config.features.socketIO) {
      socketService.initialize(httpServer);
      loggers.info('✅ Socket.IO initialized');
    }

    // Start server
    httpServer.listen(config.port, () => {
      loggers.system.startup();
      loggers.info(`🚀 Server running on port ${config.port}`);
      loggers.info(`📝 Environment: ${config.env}`);
      loggers.info(`🔗 API URL: http://localhost:${config.port}/api/v1`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      loggers.system.shutdown();
      
      // Close HTTP server
      httpServer.close(() => {
        loggers.info('HTTP server closed');
      });

      // Disconnect database
      await prisma.$disconnect();
      loggers.info('Database disconnected');

      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      loggers.error('Uncaught Exception', error);
      shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      loggers.error('Unhandled Rejection', { reason, promise });
      shutdown();
    });

  } catch (error) {
    loggers.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();