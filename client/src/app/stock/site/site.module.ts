import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SiteComponent } from './site.component';
import { SiteRoutingModule } from './site-routing.module';
import { StockCheckModule } from '../stock-check/stock-check.module';


@NgModule({
  declarations: [ 
    SiteComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SiteRoutingModule,
    StockCheckModule
  ]
})
export class SiteModule { } 