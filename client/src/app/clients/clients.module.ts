import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ClientsComponent } from './clients.component';
import { ClientsRoutingModule } from './clients-routing.module';

@NgModule({
  declarations: [ClientsComponent],
  imports: [
    CommonModule,
    FormsModule,
    ClientsRoutingModule
  ]
})
export class ClientsModule { } 