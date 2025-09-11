import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuppliersRoutingModule } from './suppliers-routing.module';
import { SuppliersComponent } from './suppliers.component';

@NgModule({
  declarations: [
    SuppliersComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SuppliersRoutingModule
  ]
})
export class SuppliersModule { }
