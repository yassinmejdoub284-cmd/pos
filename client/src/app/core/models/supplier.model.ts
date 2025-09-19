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
  createdAt: string;
  updatedAt: string;
  currentDebt?: number; // What we owe the supplier
  totalExpenses?: number; // Total amount we've spent with this supplier
  totalPayments?: number; // Total amount we've paid to this supplier
  recentExpenses?: SupplierExpense[]; // Recent expenses with this supplier
  _count?: {
    expenses: number;
    debtTransactions: number;
    payments: number;
  };
}

export interface SupplierExpense {
  id: number;
  amount: number;
  date: string;
  category: {
    id: number;
    name: string;
  };
  notes?: string;
  isPaid: boolean;
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
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
}

export interface SupplierStatementItem {
  type: string;
  date: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  id: number;
  clickable: boolean;
  expenseId?: number;
  bonId?: string;
}

export interface SupplierSummary {
  id: number;
  name: string;
  currentDebt: number;
  totalExpenses: number;
  periodExpenses: number;
  periodPayments: number;
  periodDebts: number;
  periodBalance: number;
  _count: {
    expenses: number;
    debtTransactions: number;
    payments: number;
  };
}

export interface SupplierPayment {
  id: number;
  amount: number;
  notes: string;
  createdAt: string;
  supplier: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
}
