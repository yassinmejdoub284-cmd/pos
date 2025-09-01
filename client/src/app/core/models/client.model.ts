export interface Client {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  clientType: ClientType;
  loyaltyPoints: number;
  totalSpent: number;
  favoriteProducts?: string;
  notes?: string;
  isActive: boolean;
  ageGroup?: AgeGroup;
  createdAt: Date;
  updatedAt: Date;
  currentDebt?: number;
  maxDebt?: number;
  allowDebt?: boolean;
  _count?: {
    sales: number;
  };
  sales?: any[];
}

export type ClientType = 'INDIVIDUAL' | 'BUSINESS' | 'WHOLESALE';
export type AgeGroup = 'ADULT' | 'TEEN' | 'ELDER' | 'CHILD';

export interface CreateClientRequest {
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  clientType?: ClientType;
  notes?: string;
  ageGroup?: AgeGroup;
}

export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  clientType?: ClientType;
  loyaltyPoints?: number;
  totalSpent?: number;
  favoriteProducts?: string;
  notes?: string;
  isActive?: boolean;
  ageGroup?: AgeGroup;
  currentDebt?: number;
  maxDebt?: number;
  allowDebt?: boolean;
}

export interface ClientsResponse {
  clients: Client[];
  pagination: {
    page: number;
    limit: number;
    total?: number;
    pages?: number;
  };
} 