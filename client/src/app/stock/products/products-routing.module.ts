import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductsComponent } from './products.component';
import { ProductCommentsComponent } from './product-comments/product-comments.component';

const routes: Routes = [
  {
    // Sous-module : gestion des commentaires de preparation.
    path: 'comments',
    component: ProductCommentsComponent
  },
  {
    path: '',
    component: ProductsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductsRoutingModule { } 