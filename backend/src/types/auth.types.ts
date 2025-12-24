import { UserRole } from '@prisma/client';

export interface RegisterData {
  phoneNumber: string;
  email?: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyName?: string;
  companyRegistration?: string;
  driversLicense?: string;
  idDocument?: string;
}

export interface LoginData {
  identifier: string; // phone or email
  password: string;
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  profileImage?: string;
}

