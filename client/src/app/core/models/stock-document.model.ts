export interface StockDocument {
  id: number;
  numero: string;
  type: 'BON_EXPEDITION' | 'BON_ENTREE_DEPOT' | 'BON_TRANSFERT' | 'BON_ENTREE_MAGASIN';
  status: 'PREPARED' | 'SENT' | 'RECEIVED' | 'CANCELLED';
  emetteurId: number;
  destinataireId: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  emetteur?: Depot;
  destinataire?: Depot;
  supplier?: Supplier;
  items?: StockDocumentItem[];
  statusHistory?: DocumentStatusHistory[];
  sourceLinks?: StockDocumentLink[];
  targetLinks?: StockDocumentLink[];
}

export interface StockDocumentItem {
  id: number;
  documentId: number;
  productId: number;
  famille: string;
  quantity: number;
  purchasePrice?: number;
  batch?: string;
  notes?: string;
  barcode?: string;
  
  product?: Product;
}

export interface DocumentStatusHistory {
  id: number;
  documentId: number;
  status: string;
  userId: number;
  notes?: string;
  createdAt: Date;
  
  user?: User;
}

export interface StockDocumentLink {
  id: number;
  sourceDocumentId: number;
  targetDocumentId: number;
  linkType: string;
  createdAt: Date;
  
  sourceDocument?: StockDocument;
  targetDocument?: StockDocument;
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

export interface Product {
  id: number;
  reference: string;
  name: string;
  designation_legale?: string;
  famille: string;
  barcode?: string;
  unite: string;
  prix_vente_TTC: number;
  prix_achat?: number;
  actif: boolean;
}

export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface Supplier {
  id: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  taxNumber?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
}

export interface ScanResult {
  document: StockDocument;
  item: StockDocumentItem;
  canReceive: boolean;
  isNewDocument?: boolean;
}

export interface TransferItem {
  productId: number;
  famille: string;
  quantity: number;
  batch?: string;
  notes?: string;
  product?: Product;
} 