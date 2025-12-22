import { Router } from 'express';
import authRoutes from './routes/auth.routes';

const router = Router();

router.use('/v1/auth', authRoutes);

export default router;