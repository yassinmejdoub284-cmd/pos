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
                {
                path: 'shop-transfer/:depotId',
                loadChildren: () => import('./shop-transfer/shop-transfer.module').then(m => m.ShopTransferModule)
              },
              {
                path: 'branch-inventory/:depotId',
                loadChildren: () => import('./branch-inventory/branch-inventory.module').then(m => m.BranchInventoryModule)
              },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StockRoutingModule { }
