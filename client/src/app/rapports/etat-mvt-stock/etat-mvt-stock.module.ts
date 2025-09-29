import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { EtatMvtStockComponent } from './etat-mvt-stock.component';

const routes: Routes = [
  { path: '', component: EtatMvtStockComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    EtatMvtStockComponent
  ]
})
export class EtatMvtStockModule { }

