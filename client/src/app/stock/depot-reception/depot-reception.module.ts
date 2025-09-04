import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DepotReceptionComponent } from './depot-reception.component';
import { DepotReceptionRoutingModule } from './depot-reception-routing.module';

@NgModule({
  declarations: [
    DepotReceptionComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    DepotReceptionRoutingModule
  ],
  exports: [
    DepotReceptionComponent
  ]
})
export class DepotReceptionModule { }
