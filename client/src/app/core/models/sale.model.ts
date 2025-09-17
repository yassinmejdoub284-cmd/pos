export interface Sale {
  id: number;
  items: SaleItem[];
  total: number;
  tax: number;
  discount: number;
  finalTotal: number;
  paymentMethod?: PaymentMethod;
  status: SaleStatus;
  cashierId: number;
  customerId?: number;
  expectedDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  client?: { firstName: string; lastName: string; code: string };
  user?: { firstName: string; lastName: string };
  loyaltyPointsEarned?: number;
  // Payment type: COMPTANT (instant) or CREDIT (client owes money)
  paymentType?: 'COMPTANT' | 'CREDIT';
  // Advance payment fields for temporary sales
  advancePayment?: number;
  advancePaymentMethod?: PaymentMethod;
  advancePaymentDate?: Date;
  advancePaymentNotes?: string;
  // Wholesale flag
  isWholesale?: boolean;
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
  // Wholesale fields
  isWholesale?: boolean;
  bundleQuantity?: number;
  bundleSize?: number;
  bundlePrice?: number;
  marginPercent?: number;
  isApproved?: boolean;
}

export interface PaymentMethod {
  id: number;
  name: string;
  type: 'CASH' | 'CARD' | 'MOBILE' | 'BANK_TRANSFER';
  isActive: boolean;
}

export type SaleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'TEMPORARY' | 'PENDING_ADMIN' | 'CADEAU';

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
} 