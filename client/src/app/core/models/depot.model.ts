export interface Depot {
  id: number;
  name: string;
  code: string;
  type: DepotType;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  managerId?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type DepotType = 'MAIN' | 'BRANCH' | 'SHOP' | 'WAREHOUSE';

export interface Inventory {
  id: number;
  depotId: number;
  productId: number;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastUpdated: Date;
}

export interface StockTransfer {
  id: number;
  fromDepotId: number;
  toDepotId: number;
  items: StockTransferItem[];
  status: TransferStatus;
  requestedBy: number;
  approvedBy?: number;
  requestedAt: Date;
  approvedAt?: Date;
  transferredAt?: Date;
  notes?: string;
}

export interface StockTransferItem {
  id: number;
  transferId: number;
  productId: number;
  quantity: number;
  transferredQuantity: number;
}

export type TransferStatus = 'PENDING' | 'APPROVED' | 'TRANSFERRED' | 'CANCELLED'; 