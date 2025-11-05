import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RapportsComponent } from './rapports.component';

const routes: Routes = [
  { path: '', component: RapportsComponent },
  { 
    path: 'daily-monthly', 
    loadChildren: () => import('./daily-monthly/daily-monthly.module').then(m => m.DailyMonthlyModule)
  },
  { 
    path: 'sales-by-category', 
    loadChildren: () => import('./sales-by-category/sales-by-category.module').then(m => m.SalesByCategoryModule)
  },
  { 
    path: 'credit-sales', 
    loadChildren: () => import('./credit-sales/credit-sales.module').then(m => m.CreditSalesModule)
  },
  { 
    path: 'finance', 
    loadChildren: () => import('./finance/finance.module').then(m => m.FinanceModule)
  },
  { 
    path: 'expenses', 
    loadChildren: () => import('./expenses/expenses.module').then(m => m.ExpensesModule)
  },
  { 
    path: 'dashboard', 
    loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule)
  },
  { 
    path: 'inventory-sales-reconciliation', 
    loadChildren: () => import('./inventory-sales-reconciliation/inventory-sales-reconciliation.module').then(m => m.InventorySalesReconciliationModule)
  },
  { 
    path: 'etat-mvt-stock', 
    loadChildren: () => import('./etat-mvt-stock/etat-mvt-stock.module').then(m => m.EtatMvtStockModule)
  },
  { 
    path: 'sessions-history', 
    loadChildren: () => import('./sessions-history/sessions-history.module').then(m => m.SessionsHistoryModule)
  },
  { 
    path: 'inventory-balance', 
    loadChildren: () => import('./inventory-balance/inventory-balance.module').then(m => m.InventoryBalanceModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RapportsRoutingModule { }
