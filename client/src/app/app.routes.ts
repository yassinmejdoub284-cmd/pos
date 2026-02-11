import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleRedirectGuard } from './core/guards/role-redirect.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'home',
    canActivate: [authGuard, roleRedirectGuard],
    loadChildren: () => import('./home/home.module').then(m => m.HomeModule)
  },
  {
    path: 'caisse',
    canActivate: [authGuard],
    loadChildren: () => import('./caisse/caisse.module').then(m => m.CaisseModule)
  },
  {
    path: 'historique',
    canActivate: [authGuard],
    loadChildren: () => import('./historique/historique.module').then(m => m.HistoriqueModule)
  },
  {
    path: 'cloture',
    canActivate: [authGuard],
    loadChildren: () => import('./cloture/cloture.module').then(m => m.ClotureModule)
  },
  {
    path: 'stock',
    canActivate: [authGuard],
    loadChildren: () => import('./stock/stock.module').then(m => m.StockModule)
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadChildren: () => import('./inventory/inventory.module').then(m => m.InventoryModule)
  },
  {
    path: 'parametres',
    canActivate: [authGuard],
    loadChildren: () => import('./parametres/parametres.module').then(m => m.ParametresModule)
  },
  {
    path: 'rapports',
    canActivate: [authGuard],
    loadChildren: () => import('./rapports/rapports.module').then(m => m.RapportsModule)
  },
  {
    path: 'approvals',
    canActivate: [authGuard],
    loadChildren: () => import('./approvals/approvals.module').then(m => m.ApprovalsModule)
  },
  {
    path: 'charges',
    canActivate: [authGuard],
    loadChildren: () => import('./charges/charges.module').then(m => m.ChargesModule)
  },
  {
    path: 'clients',
    canActivate: [authGuard],
    loadChildren: () => import('./clients/clients.module').then(m => m.ClientsModule)
  },
  {
    path: 'suppliers',
    canActivate: [authGuard],
    loadChildren: () => import('./suppliers/suppliers.module').then(m => m.SuppliersModule)
  },
  {
    path: 'client-gros',
    canActivate: [authGuard],
    loadChildren: () => import('./client-gros/client-gros.module').then(m => m.ClientGrosModule)
  },
  {
    path: 'client-statement',
    canActivate: [authGuard],
    loadChildren: () => import('./client-statement/client-statement.module').then(m => m.ClientStatementModule)
  },
  {
    path: 'client-payments',
    canActivate: [authGuard],
    loadChildren: () => import('./client-payments/client-payments.module').then(m => m.ClientPaymentsModule)
  },
  {
    path: 'supplier-statement',
    canActivate: [authGuard],
    loadChildren: () => import('./supplier-statement/supplier-statement.module').then(m => m.SupplierStatementModule)
  },
  {
    path: 'supplier-payments',
    canActivate: [authGuard],
    loadChildren: () => import('./supplier-payments/supplier-payments.module').then(m => m.SupplierPaymentsModule)
  },
  {
    path: 'stock-management',
    canActivate: [authGuard],
    loadChildren: () => import('./stock-management/stock-management.module').then(m => m.StockManagementModule)
  },
  {
    path: 'scanning',
    canActivate: [authGuard],
    loadChildren: () => import('./scanning/scanning.module').then(m => m.ScanningModule)
  },
  {
    path: 'documents-reception',
    canActivate: [authGuard],
    loadChildren: () => import('./documents-reception/documents-reception.module').then(m => m.DocumentsReceptionModule)
  },
  {
    path: 'extrait-par-article',
    canActivate: [authGuard],
    loadChildren: () => import('./extrait-par-article/extrait-par-article.module').then(m => m.ExtraitParArticleModule)
  },
  {
    path: 'admin-home',
    canActivate: [authGuard],
    loadChildren: () => import('./admin-home/admin-home.module').then(m => m.AdminHomeModule)
  },
  {
    path: 'factures',
    canActivate: [authGuard],
    loadChildren: () => import('./factures/factures.module').then(m => m.FacturesModule)
  }
];
