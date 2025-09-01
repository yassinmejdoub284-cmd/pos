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
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StockRoutingModule { }
