export interface ProduitDeCaisse {
  id: number;
  name: string;
  price: number;
  productIds: number[];
  depotId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  depot?: {
    id: number;
    name: string;
    code: string;
    type: string;
  };
}

export interface CreateProduitDeCaisseRequest {
  name: string;
  price: number;
  productIds: number[];
  depotId: number;
  isActive?: boolean;
}

export interface UpdateProduitDeCaisseRequest {
  name?: string;
  price?: number;
  productIds?: number[];
  depotId?: number;
  isActive?: boolean;
}
