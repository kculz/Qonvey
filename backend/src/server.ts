// Server Entry Point
// Location: backend/src/server.ts

import { createServer } from 'http';
import app from '@/app';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import { socketService } from '@/services/socket.service';
import sequelize from '@/config/database'; // Changed from prisma to sequelize

const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate(); // Sequelize authentication method
    loggers.info('✅ Database connected successfully');

    // Sync models (use cautiously in production)
    if (config.env === 'development') {
      await sequelize.sync({ alter: false }); // Options: force, alter, or nothing
      loggers.info('✅ Database synced');
    } else {
      // In production, you might want to run migrations instead
      await sequelize.sync();
      loggers.info('✅ Database models loaded');
    }

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
      loggers.info(`🗄️  Database: ${config.db.name}@${config.db.host}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      loggers.system.shutdown();
      
      // Close HTTP server
      httpServer.close(() => {
        loggers.info('HTTP server closed');
      });

      // Close database connection
      await sequelize.close();
      loggers.info('Database connection closed');

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
    
    // Close connection if open
    if (sequelize) {
      await sequelize.close();
    }
    
    process.exit(1);
  }
};

startServer();