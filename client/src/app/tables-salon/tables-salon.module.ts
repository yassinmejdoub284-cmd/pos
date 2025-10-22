import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TablesSalonComponent } from './tables-salon.component';
import { TablesSalonRoutingModule } from './tables-salon-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TablesSalonRoutingModule,
    TablesSalonComponent
  ]
})
export class TablesSalonModule { }
