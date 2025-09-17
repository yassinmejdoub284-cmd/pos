export interface Product {
  id: number;
  name: string;
  designation_legale?: string;
  description?: string;
  familleId: number;
  famille?: ProductFamily;
  barcode?: string;
  unite: string;
  prix_vente_TTC: number;
  prix_achat?: number;
  tva: number;
  photo?: string;
  duree_conservation?: number;
  // Vrac fields
  isVrac?: boolean;
  originalProductId?: number;
  originalProduct?: Product;
  isStockable?: boolean;
  // New configuration fields
  isVraguable?: boolean;
  initialStock?: number;
  minStock?: number;
  maxStock?: number;
  displayIndex?: number;
  // Wholesale/Bundle fields
  isWholesale?: boolean;
  bundleSize?: number;
  bundlePrice?: number;
  createdAt: Date;
  updatedAt: Date;
  inventory?: Inventory[];
  conservation?: ProductConservation[];
  vracProducts?: Product[];
  vracPrices?: VracPrice[];
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

export interface VracPrice {
  id: number;
  productId: number;
  price: number;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount: number;
  // Wholesale/Bundle fields
  isWholesale: boolean;
  bundleQuantity?: number;
  bundleSize?: number;
  bundlePrice?: number;
  marginPercent?: number;
  isApproved: boolean;
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