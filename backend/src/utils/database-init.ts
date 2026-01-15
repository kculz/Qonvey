// src/utils/database-init.ts
import { sequelize } from '../models';
import logger from './logger';

export const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');
    
    // Sync models (use carefully in production)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database synced.');
    }
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    process.exit(1);
  }
};