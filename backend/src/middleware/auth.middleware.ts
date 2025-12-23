import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import  env  from '@/config/env';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, env.jwt) as any;
    req.user = decoded.user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};