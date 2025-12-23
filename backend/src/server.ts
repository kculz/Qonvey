import app from '@/app';
import env  from '@/config/env';

const startServer = async () => {
  const server = app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();