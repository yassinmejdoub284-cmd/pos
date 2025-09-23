import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CaisseRoutingModule } from './caisse-routing.module';
import { CaisseComponent } from './caisse.component';
import { TicketActionDialogComponent } from '../shared/ticket-action-dialog/ticket-action-dialog.component';
import { LazyImageDirective } from '../shared/directives/lazy-image.directive';

@NgModule({
  declarations: [CaisseComponent],
  imports: [
    CommonModule,
    FormsModule,
    CaisseRoutingModule,
    TicketActionDialogComponent,
    LazyImageDirective
  ]
})
export class CaisseModule { }
