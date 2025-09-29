export interface Client {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  address?: string;
  matriculeFiscal?: string;
  clientType: ClientType;
  depotId?: number | null; // null = invoicing only, -1 = any depot, >0 = specific depot
  depot?: {
    id: number;
    name: string;
    code: string;
    type: string;
  };
  loyaltyPoints: number;
  totalSpent: number;
  favoriteProducts?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  currentDebt?: number;
  maxDebt?: number;
  allowDebt?: boolean;
  _count?: {
    sales: number;
    debtTransactions: number;
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
  address?: string;
  matriculeFiscal?: string;
  clientType?: ClientType;
  depotId?: number | null; // null = invoicing only, -1 = any depot, >0 = specific depot
  notes?: string;
  allowDebt?: boolean;
  maxDebt?: number | null;
}

export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  address?: string;
  matriculeFiscal?: string;
  clientType?: ClientType;
  depotId?: number | null; // null = invoicing only, -1 = any depot, >0 = specific depot
  loyaltyPoints?: number;
  totalSpent?: number;
  favoriteProducts?: string;
  notes?: string;
  isActive?: boolean;
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