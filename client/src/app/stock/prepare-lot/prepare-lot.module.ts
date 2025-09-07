import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PrepareLotComponent } from './prepare-lot.component';
import { PrepareLotRoutingModule } from './prepare-lot-routing.module';

@NgModule({
  declarations: [
    PrepareLotComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    PrepareLotRoutingModule
  ],
  exports: [
    PrepareLotComponent
  ]
})
export class PrepareLotModule { }
