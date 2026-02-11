import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/caisse', pathMatch: 'full' },
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
    path: 'clients',
    loadChildren: () => import('./clients/clients.module').then(m => m.ClientsModule)
  },
  {
    path: 'charges',
    loadChildren: () => import('./charges/charges.module').then(m => m.ChargesModule)
  },
  {
    path: 'suppliers',
    loadChildren: () => import('./suppliers/suppliers.module').then(m => m.SuppliersModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomeModule)
  },
  {
    path: 'inventory',
    loadChildren: () => import('./inventory/inventory.module').then(m => m.InventoryModule)
  },
  {
    path: 'factures',
    loadChildren: () => import('./factures/factures.module').then(m => m.FacturesModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { } 