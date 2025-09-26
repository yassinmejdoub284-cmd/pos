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
