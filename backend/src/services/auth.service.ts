import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/database';

class AuthService {
  async register(userData: any) {
    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Create user and subscription
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        firstName: userData.firstName,
        lastName: userData.lastName,
        passwordHash: hashedPassword,
        subscription: {
          create: {
            plan: 'FREE',
            status: 'TRIAL',
            trialStartDate: new Date(),
            trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            hasUsedTrial: true,
          },
        },
      },
      include: {
        subscription: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Create JWT token
    const token = jwt.sign({ userId: user.id }, env.jwtSecret, {
      expiresIn: '7d',
    });

    return token;
  }
}

export const authService = new AuthService();