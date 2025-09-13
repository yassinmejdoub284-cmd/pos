export interface InventorySession {
  id: number;
  numero: string;
  depotId: number;
  status: InventorySessionStatus;
  startedBy: number;
  closedBy?: number;
  postedBy?: number;
  startedAt: Date;
  closedAt?: Date;
  postedAt?: Date;
  notes?: string;
  totalEcartValue?: number;
  totalEcartQty?: number;
  createdAt: Date;
  updatedAt: Date;
  depot?: {
    name: string;
    code: string;
  };
  starter?: {
    firstName: string;
    lastName: string;
    username: string;
  };
  closer?: {
    firstName: string;
    lastName: string;
    username: string;
  };
  poster?: {
    firstName: string;
    lastName: string;
    username: string;
  };
  items?: InventoryItem[];
  _count?: {
    items: number;
  };
}

export interface InventoryItem {
  id: number;
  sessionId: number;
  productId: number;
  theoreticalQuantity: number;
  countedQuantity?: number;
  ecartQuantity?: number;
  ecartValue?: number;
  reason?: InventoryReason;
  notes?: string;
  countedAt?: Date;
  countedBy?: number;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    id: number;
    name: string;
    barcode?: string;
    unite: string;
    prix_vente_TTC: number;
    famille?: {
      name: string;
    };
  };
  counter?: {
    firstName: string;
    lastName: string;
    username: string;
  };
}

export interface InventorySummary {
  session: {
    id: number;
    numero: string;
    status: string;
    startedAt: Date;
    closedAt?: Date;
    postedAt?: Date;
  };
  statistics: {
    totalItems: number;
    countedItems: number;
    remainingItems: number;
    itemsWithEcart: number;
    totalEcartValue: number;
    totalEcartQty: number;
  };
  ecarts: Array<{
    productId: number;
    productName: string;
    theoreticalQuantity: number;
    countedQuantity?: number;
    ecartQuantity?: number;
    ecartValue?: number;
    reason?: string;
    notes?: string;
  }>;
}

export type InventorySessionStatus = 'DRAFT' | 'IN_PROGRESS' | 'CLOSED' | 'POSTED';

export type InventoryReason = 'PHYSICAL_COUNT_DIFFERENCE' | 'SUSPICION_OF_ANOMALY';

export interface CreateInventorySessionRequest {
  depotId?: number;
  notes?: string;
}

export interface UpdateInventoryItemRequest {
  countedQuantity: number | null;
  reason?: InventoryReason;
  notes?: string;
}

export interface UpdateSessionStatusRequest {
  status: InventorySessionStatus;
  notes?: string;
}
