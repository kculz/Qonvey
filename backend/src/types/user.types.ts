export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  PENDING = 'PENDING'
}

export enum UserRole {
  DRIVER = 'DRIVER',
  CARGO_OWNER = 'CARGO_OWNER',
  ADMIN = 'ADMIN'
}

export interface AuthUser {
  id: string;
  role: UserRole;
  subscription?: any;
}

export interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}