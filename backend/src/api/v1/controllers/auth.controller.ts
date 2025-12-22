import { authService } from '@/services/auth.service';
import { Request, Response } from 'express';

export const register = async (req: Request, res: Response) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const token = await authService.login(email, password);
    res.json({ token });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const logout = (req: Request, res: Response) => {
  // Implement logout logic (e.g., invalidate token)
  res.json({ message: 'Logged out successfully' });
};

export const refreshToken = (req: Request, res: Response) => {
  // Implement refresh token logic
  res.json({ message: 'Refresh token endpoint' });
};