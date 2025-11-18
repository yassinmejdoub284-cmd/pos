import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DocumentsRoutingModule } from './documents-routing.module';
import { BonEntreeComponent } from './bon-entree/bon-entree.component';
// Removed Bon de sortie, transfert, livraison components
import { DocumentComponent } from './document/document.component';

@NgModule({
  declarations: [
    BonEntreeComponent,
    DocumentComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    DocumentsRoutingModule
  ]
})
export class DocumentsModule {} 