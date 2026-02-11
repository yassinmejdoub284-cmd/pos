export interface BoutiqueRevenue {
    depotId: number;
    depotName: string;
    revenue: number;
}

export interface DepotRevenue {
    depotId: number;
    depotName: string;
    revenue: number;
}

export interface SupplierCredit {
    depotId: number | 'unassigned';
    depotName: string;
    totalCredit: number;
}

export interface BoutiqueExpense {
    depotId: number;
    depotName: string;
    totalExpense: number;
}

export interface DashboardStats {
    totalRevenue: number;
    totalExpenses: number;
    totalNet: number;
    totalSupplierCredit: number;

    revenueByBoutique: BoutiqueRevenue[];
    revenueByDepot: DepotRevenue[];
    supplierCreditByDepot: SupplierCredit[];
    expensesByBoutique: BoutiqueExpense[];
}
