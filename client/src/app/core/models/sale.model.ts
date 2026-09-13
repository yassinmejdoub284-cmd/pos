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
  depotId?: number;
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
  // Daily ticket number for printing
  dailyTicketNumber?: string;
  // Session information
  sessionId?: number;
  session?: { id: number };
  // Printed flag
  isPrinted?: boolean;
  // Paid amount (cash amount paid for this sale)
  paidAmount?: number;
  // Table information for restaurant mode
  tableInfo?: { tableNumber: number };
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  /** Description du produit : imprimee uniquement sur le ticket cuisine. */
  description?: string;
  /** Commentaires de preparation choisis en caisse, separes par ' | '.
   *  Imprimes uniquement sur le ticket cuisine. */
  comment?: string;
  /** Famille du produit : ses 3 premieres lettres sont imprimees en cuisine. */
  familyName?: string;
  /** Presente quand la vente est rechargee depuis le serveur (GET /sales/:id). */
  product?: { description?: string | null; famille?: { name?: string | null } | null };
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