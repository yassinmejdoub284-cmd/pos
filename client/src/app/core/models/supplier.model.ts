export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  depotId: number;
}

export interface CreateSupplierRequest {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  depotId: number;
}

export interface UpdateSupplierRequest {
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
}
