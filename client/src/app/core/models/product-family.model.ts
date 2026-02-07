export interface ProductFamily {
  id: number;
  name: string;
  description?: string;
  photo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    products: number;
  };
  products?: Product[];
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  familleId: number;
  famille?: ProductFamily;
  barcode?: string;
  unite: string;
  prix_vente_TTC: number;
  tva: number;
  photo?: string;
  createdAt: Date;
  updatedAt: Date;
  inventory?: Inventory[];
}

export interface Inventory {
  id: number;
  depotId: number;
  productId: number;
  quantity: number;
  reservedQuantity: number;
  lastUpdated: Date;
  depot?: Depot;
  product?: Product;
}


export interface Depot {
  id: number;
  name: string;
  code: string;
  type: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  managerId?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
