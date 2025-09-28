import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CaisseRoutingModule } from './caisse-routing.module';
import { CaisseComponent } from './caisse.component';
import { TicketActionDialogComponent } from '../shared/ticket-action-dialog/ticket-action-dialog.component';
import { TicketDetailsModalComponent } from '../shared/ticket-details-modal/ticket-details-modal.component';
import { LazyImageDirective } from '../shared/directives/lazy-image.directive';

@NgModule({
  declarations: [CaisseComponent],
  imports: [
    CommonModule,
    FormsModule,
    CaisseRoutingModule,
    TicketActionDialogComponent,
    TicketDetailsModalComponent,
    LazyImageDirective
  ]
})
export class CaisseModule { }
