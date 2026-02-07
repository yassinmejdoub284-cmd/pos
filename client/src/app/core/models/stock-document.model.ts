import { Vehicle } from './vehicle.model';
import { Driver } from './driver.model';

export interface StockDocument {
  id: number;
  numero: string;
  type: 'BON_EXPEDITION' | 'BON_ENTREE_DEPOT' | 'BON_TRANSFERT' | 'BON_ENTREE_MAGASIN' | 'FACTURE';
  status: 'PREPARED' | 'SENT' | 'RECEIVED' | 'CANCELLED' | 'COMPLETED';
  emetteurId: number;
  destinataireId: number;
  clientId?: number;
  vehicleId?: number;
  driverId?: number;
  notes?: string;
  destination?: string;
  validationFromDate?: Date;
  validationToDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  emetteur?: Depot;
  destinataire?: Depot;
  supplier?: Supplier;
  client?: Client;
  vehicle?: Vehicle;
  driver?: Driver;
  items?: StockDocumentItem[];
  statusHistory?: DocumentStatusHistory[];
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
  count?: number;
  prixUnitaire?: number;
  tva?: number;
  montantHT?: number;
  montantTVA?: number;
  montantTTC?: number;
  
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

export interface Client {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  matriculeFiscal?: string;
  postalCode?: string;
  birthday?: Date;
  clientType: string;
  loyaltyPoints: number;
  totalSpent: number;
  favoriteProducts?: string;
  allergies?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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