export interface Vehicle {
  id: number;
  matricule: string;
  model: string;
  brand: VehicleBrand;
  brandId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleRequest {
  matricule: string;
  model: string;
  brand: string;
}

export interface UpdateVehicleRequest {
  matricule?: string;
  model?: string;
  brand?: string;
  isActive?: boolean;
}

export interface VehicleBrand {
  id: number;
  name: string;
  models: string[];
  logoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleBrandRequest {
  name: string;
  models: string[];
  logoUrl?: string;
}

export interface UpdateVehicleBrandRequest {
  name?: string;
  models?: string[];
  logoUrl?: string;
  isActive?: boolean;
}
