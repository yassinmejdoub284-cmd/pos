import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DocumentsRoutingModule } from './documents-routing.module';
import { DocumentsComponent } from './documents.component';
import { BonEntreeComponent } from './bon-entree/bon-entree.component';
import { BonSortieComponent } from './bon-sortie/bon-sortie.component';

@NgModule({
  declarations: [
    BonEntreeComponent,
    BonSortieComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DocumentsRoutingModule,
    DocumentsComponent
  ]
})
export class DocumentsModule {} 