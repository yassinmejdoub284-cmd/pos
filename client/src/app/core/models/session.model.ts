export interface SessionCaisse {
  id: number;
  posId: number;
  userId: number;
  depotId?: number;
  magasinId?: number;
  openedAt: Date;
  closedAt?: Date;
  openingFund: number;
  expectedCash: number;
  countedCash?: number;
  variance?: number;
  status: SessionStatus;
  xSeq: number;
  zSeq: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    firstName: string;
    lastName: string;
  };
  depot?: {
    name: string;
    code: string;
  };
  cashMovements?: CashMovement[];
  summary?: SessionSummary;
}

export interface CashMovement {
  id: number;
  sessionId: number;
  type: CashMovementType;
  amount: number;
  reason: string;
  ticketId?: number;
  createdById: number;
  createdAt: Date;
}

export interface SessionSummary {
  expectedCash: number;
  cashSales: number;
  entree: number;
  sortie: number;
  salesByPayment: { [key: string]: { amount: number; count: number } };
  totalSales: number;
  totalTickets: number;
}

export interface OpenSessionRequest {
  openingFund: number;
  posId?: number;
  note?: string;
}

export interface CashMovementRequest {
  type: CashMovementType;
  amount: number;
  reason: string;
  ticketId?: number;
}

export interface CloseSessionRequest {
  countedCash: number;
  fonds: number;
  retraitCentrale?: number;
  denominations: { [key: string]: number };
}

export interface SessionFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
  posId?: number;
  status?: SessionStatus;
  hasVariance?: boolean;
  page?: number;
  limit?: number;
}

export interface ZReportData {
  session: SessionCaisse;
  summary: SessionSummary;
  generatedAt: Date;
  reportType: 'Z';
  closureData?: {
    withdrawalAmount: number;
    remainingBalance: number;
    countedCash: number;
  };
}

export type SessionStatus = 'OPEN' | 'CLOSED' | 'REOPENED';

export type CashMovementType = 'ENTREE' | 'SORTIE' | 'DEPOT_COFFRE' | 'RETRAIT_CENTRALE' | 'AJUSTEMENT';

export interface ClotureSettings {
  varianceThreshold: number;
  defaultFonds: number;
  denominations: number[];
  requireApprovalForVariance: boolean;
  ticketWidth: number;
  droitDeTimbre: boolean;
}
