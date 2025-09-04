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
  duree_conservation?: number;
  // Vrague fields
  isVrague?: boolean;
  originalProductId?: number;
  originalProduct?: Product;
  isStockable?: boolean;
  createdAt: Date;
  updatedAt: Date;
  inventory?: Inventory[];
  conservation?: ProductConservation[];
  vragueProducts?: Product[];
  vraguePrices?: VraguePrice[];
}

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
}

export interface ProductConservation {
  id: number;
  productId: number;
  depotId: number;
  batchQuantity: number;
  remainingQuantity: number;
  productionDate: Date;
  expirationDate: Date;
  isExpired: boolean;
  isWarningShown: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  depot?: Depot;
}

export interface Inventory {
  id: number;
  depotId: number;
  productId: number;
  quantity: number;
  reservedQuantity: number;
  lastUpdated: Date;
  depot?: Depot;
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
  isActive: boolean;
}

export interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface StockMovement {
  id: number;
  productId: number;
  quantity: number;
  type: 'IN' | 'OUT' | 'TRANSFER';
  fromDepot?: string;
  toDepot?: string;
  reason: string;
  reference?: string;
  date: Date;
  userId: number;
}

export interface VraguePrice {
  id: number;
  productId: number;
  price: number;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkImportResult {
  results: Array<{
    row: number;
    success: boolean;
    product?: Product;
    preview?: any;
  }>;
  errors: Array<{
    row: number;
    error: string;
  }>;
  summary: {
    total: number;
    success: number;
    errors: number;
  };
} 