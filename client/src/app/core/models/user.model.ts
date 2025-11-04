export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  depotId?: number;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  companyId?: number;
  companyName?: string;
  userType?: 'patisserie' | 'enterprise';
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER' | 'ENTERPRISE_USER';

export interface UserPermissions {
  canManageUsers: boolean;
  canManageProducts: boolean;
  canManageStock: boolean;
  canApproveTransfers: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canProcessSales: boolean;
  canViewHistory: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  permissions: UserPermissions;
}

export interface LoginRequest {
  pin?: string;
  token?: string;
  username?: string;
  password?: string;
  depotId?: number;
} 