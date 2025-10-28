// src/types/index.ts

export interface Token {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface AccountInfoData {
  id: string;
  email: string;
  password: string;
  lastUpdate: Date;
}

export interface AdminCredentials {
  username: string;
  password: string;
}