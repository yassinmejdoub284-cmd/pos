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
  createdAt: Date;
  updatedAt: Date;
  
  // Additional properties from backend
  currentDebt?: number;
  totalExpenses?: number;
  totalPayments?: number;
  recentExpenses?: any[];
  _count?: {
    debtTransactions: number;
    expenses: number;
    payments: number;
  };
}

export interface CreateSupplierRequest {
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
  depotId?: number | null;
  currentDebt?: number;
}

export interface UpdateSupplierRequest {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  taxNumber?: string;
  paymentTerms?: string;
  notes?: string;
  isActive?: boolean;
}

export interface SupplierStatement {
  supplier: Supplier;
  statement: SupplierStatementItem[];
  summary: SupplierSummary;
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
}

export interface SupplierStatementItem {
  id: number;
  date: string;
  type: string;
  reference: string;
  description: string;
  amount: number;
  balance: number;
  debit: number;
  credit: number;
  clickable: boolean;
  bonId?: number;
}

export interface SupplierSummary {
  id: number;
  name: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  periodExpenses: number;
  periodPayments: number;
  periodDebts: number;
  periodBalance: number;
  currentDebt: number;
}

export interface SupplierPayment {
  id: number;
  supplierId: number;
  supplier?: Supplier;
  amount: number;
  date: Date;
  notes?: string;
  createdAt: Date;
  userId?: number;
  user?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}