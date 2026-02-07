import { Product, ProductFamily, Inventory, Depot } from './product.model';

export interface ProduitDeCaisseDepot {
  id: number;
  produitDeCaisseId: number;
  depotId: number;
  createdAt: Date;
  updatedAt: Date;
  depot?: Depot;
}

export interface ProduitDeStock {
  id: number;
  name: string;
  designation_legale?: string;
  description?: string;
  familleId: number;
  famille?: ProductFamily;
  barcode?: string;
  unite: string;
  prix_vente_TTC: number;
  price: number; // Alias for prix_vente_TTC
  prix_achat?: number;
  tva: number;
  photo?: string;
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
  // Stock-specific fields - now as sub-products
  parentProductId?: number;
  parentProduct?: Product;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  depotAssignments?: ProduitDeCaisseDepot[];
  assignedDepots?: Depot[]; // Computed field for easier access
  inventory?: Inventory[];
  vracProducts?: Product[];
}

// Keep alias for backward compatibility
export type ProduitDeCaisse = ProduitDeStock;

export interface CreateProduitDeStockRequest {
  name: string;
  designation_legale?: string;
  description?: string;
  familleId: number;
  barcode?: string;
  unite: string;
  prix_vente_TTC: number;
  prix_achat?: number;
  tva: number;
  photo?: string;
  // Vrac fields
  isVrac?: boolean;
  originalProductId?: number;
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
  // Stock-specific fields - now as sub-products
  parentProductId?: number;
  depotIds: number[]; // Array of depot IDs to assign to
  isActive?: boolean;
}

// Keep alias for backward compatibility
export type CreateProduitDeCaisseRequest = CreateProduitDeStockRequest;

export interface UpdateProduitDeStockRequest {
  name?: string;
  designation_legale?: string;
  description?: string;
  familleId?: number;
  barcode?: string;
  unite?: string;
  prix_vente_TTC?: number;
  prix_achat?: number;
  tva?: number;
  photo?: string;
  // Vrac fields
  isVrac?: boolean;
  originalProductId?: number;
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
  // Stock-specific fields - now as sub-products
  parentProductId?: number;
  depotIds?: number[]; // Array of depot IDs to assign to
  isActive?: boolean;
}

// Keep alias for backward compatibility
export type UpdateProduitDeCaisseRequest = UpdateProduitDeStockRequest;
