export interface Driver {
  id: number;
  nom: string;
  prenom: string;
  cin: string;
  phone?: string;
  email?: string;
  address?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  isActive: boolean;
  depotId?: number;
  depot?: {
    id: number;
    name: string;
    code: string;
    type: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDriverRequest {
  nom: string;
  prenom: string;
  cin: string;
  phone?: string;
  email?: string;
  address?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  depotId?: number;
}

export interface UpdateDriverRequest {
  nom?: string;
  prenom?: string;
  cin?: string;
  phone?: string;
  email?: string;
  address?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  isActive?: boolean;
  depotId?: number;
}

export interface DriversResponse {
  drivers: Driver[];
  pagination: {
    page: number;
    limit: number;
    total?: number;
    pages?: number;
  };
}
