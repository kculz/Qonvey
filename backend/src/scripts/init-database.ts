import { sequelize } from '../models';
import logger from '../utils/logger';
import  User  from '../models/user.model';

async function initializeDatabase() {
  try {
    // Test connection
    await sequelize.authenticate();
    logger.info('Database connection established.');

    // Sync models with database
    if (process.env.NODE_ENV === 'development') {
      // Use alter in development
      await sequelize.sync({ alter: true });
      logger.info('Database models synced.');
    } else if (process.env.NODE_ENV === 'test') {
      // Use force in test (wipes all data)
      await sequelize.sync({ force: true });
      logger.info('Database models synced with force.');
    } else {
      // Just authenticate in production
      logger.info('Production database connected.');
    }

    // Create default admin user if doesn't exist
    // import  User  from '../models/user.model';  

    const adminExists = await User.findOne({
      where: { role: 'ADMIN' },
    });

    if (!adminExists && process.env.DEFAULT_ADMIN_PHONE) {
      await User.create({
        phone_number: process.env.DEFAULT_ADMIN_PHONE,
        first_name: 'Admin',
        last_name: 'User',
        password_hash: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
        role: 'ADMIN',
        status: 'ACTIVE',
        email_verified: true,
        phone_verified: true,
      });
      logger.info('Default admin user created.');
    }

    logger.info('Database initialization completed.');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

export default initializeDatabase;