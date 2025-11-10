import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StockComponent } from './stock.component';

const routes: Routes = [
  { path: '', component: StockComponent },
  { 
    path: 'produits', 
    loadChildren: () => import('./products/products.module').then(m => m.ProductsModule) 
  },
  { 
    path: 'site/:id', 
    loadChildren: () => import('./site/site.module').then(m => m.SiteModule) 
  },
  { 
    path: 'documents', 
    loadChildren: () => import('./documents/documents.module').then(m => m.DocumentsModule) 
  },
  { 
    path: 'families', 
    loadChildren: () => import('./families/families.module').then(m => m.FamiliesModule) 
  },
  { 
    path: 'wholesale', 
    loadChildren: () => import('./wholesale/wholesale.module').then(m => m.WholesaleModule) 
  },
  { 
    path: 'depot-reception/:depotId', 
    loadChildren: () => import('./depot-reception/depot-reception.module').then(m => m.DepotReceptionModule) 
  },
  { 
    path: 'prepare-lot/:depotId', 
    loadChildren: () => import('./prepare-lot/prepare-lot.module').then(m => m.PrepareLotModule) 
  },
  { path: 'shop-transfer/:depotId', loadChildren: () => import('./shop-transfer/shop-transfer.module').then(m => m.ShopTransferModule) },
  { path: 'branch-inventory/:depotId', loadChildren: () => import('./branch-inventory/branch-inventory.module').then(m => m.BranchInventoryModule) },
  { path: 'entry/:depotId', loadChildren: () => import('./entry/entry.module').then(m => m.EntryModule) },
  { path: 'stock-history/:depotId', loadChildren: () => import('./stock-history/stock-history.module').then(m => m.StockHistoryModule) },
  { path: 'scan/:depotId', loadChildren: () => import('./scan-reception/scan-reception.module').then(m => m.ScanReceptionModule) },
  { path: 'produits-de-caisse', loadChildren: () => import('./produits-de-caisse/produits-de-caisse.module').then(m => m.ProduitsDeCaisseModule) },
  { path: 'transfer-vers-vrag', loadChildren: () => import('./transfer-vers-vrag/transfer-vers-vrag.module').then(m => m.TransferVersVragModule) },
  { path: 'transport', loadChildren: () => import('./transport/transport.module').then(m => m.TransportModule) },
  { path: 'vehicles', loadChildren: () => import('./vehicles/vehicles.module').then(m => m.VehiclesModule) },
  { path: 'drivers', loadChildren: () => import('./drivers/drivers.module').then(m => m.DriversModule) },
  { 
    path: 'documents/bon-retour/:depotId', 
    loadChildren: () => import('./documents/bon-retour/bon-retour.module').then(m => m.BonRetourModule) 
  },
  { 
    path: 'documents/bon-retour/edit/:documentId', 
    loadChildren: () => import('./documents/bon-retour/bon-retour.module').then(m => m.BonRetourModule) 
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StockRoutingModule { }
