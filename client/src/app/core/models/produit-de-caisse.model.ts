export interface ProduitDeCaisse {
  id: number;
  name: string;
  price: number;
  productIds: number[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProduitDeCaisseRequest {
  name: string;
  price: number;
  productIds: number[];
}

export interface UpdateProduitDeCaisseRequest {
  name?: string;
  price?: number;
  productIds?: number[];
  isActive?: boolean;
}
