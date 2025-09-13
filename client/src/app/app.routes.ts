import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  { 
    path: 'auth', 
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule) 
  },
  { 
    path: 'home', 
    loadChildren: () => import('./home/home.module').then(m => m.HomeModule) 
  },
  { 
    path: 'caisse', 
    loadChildren: () => import('./caisse/caisse.module').then(m => m.CaisseModule) 
  },
  { 
    path: 'historique', 
    loadChildren: () => import('./historique/historique.module').then(m => m.HistoriqueModule) 
  },
  { 
    path: 'cloture', 
    loadChildren: () => import('./cloture/cloture.module').then(m => m.ClotureModule) 
  },
  { 
    path: 'stock', 
    loadChildren: () => import('./stock/stock.module').then(m => m.StockModule) 
  },
  { 
    path: 'inventory', 
    loadChildren: () => import('./inventory/inventory.module').then(m => m.InventoryModule) 
  },
  { 
    path: 'parametres', 
    loadChildren: () => import('./parametres/parametres.module').then(m => m.ParametresModule) 
  },
  { 
    path: 'rapports', 
    loadChildren: () => import('./rapports/rapports.module').then(m => m.RapportsModule) 
  },
  { 
    path: 'approvals', 
    loadChildren: () => import('./approvals/approvals.module').then(m => m.ApprovalsModule) 
  },
  { 
    path: 'charges', 
    loadChildren: () => import('./charges/charges.module').then(m => m.ChargesModule) 
  },
  { 
    path: 'clients', 
    loadChildren: () => import('./clients/clients.module').then(m => m.ClientsModule) 
  },
  { 
    path: 'suppliers', 
    loadChildren: () => import('./suppliers/suppliers.module').then(m => m.SuppliersModule) 
  },
  { 
    path: 'client-gros', 
    loadChildren: () => import('./client-gros/client-gros.module').then(m => m.ClientGrosModule) 
  },
  { 
    path: 'client-statement', 
    loadChildren: () => import('./client-statement/client-statement.module').then(m => m.ClientStatementModule) 
  },
  { 
    path: 'client-payments', 
    loadChildren: () => import('./client-payments/client-payments.module').then(m => m.ClientPaymentsModule) 
  },
  { 
    path: 'supplier-statement', 
    loadChildren: () => import('./supplier-statement/supplier-statement.module').then(m => m.SupplierStatementModule) 
  },
  { 
    path: 'supplier-payments', 
    loadChildren: () => import('./supplier-payments/supplier-payments.module').then(m => m.SupplierPaymentsModule) 
  }
];
