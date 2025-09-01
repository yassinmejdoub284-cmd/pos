import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SiteComponent } from './site.component';
import { SiteRoutingModule } from './site-routing.module';


@NgModule({
  declarations: [ 
    SiteComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SiteRoutingModule
  ]
})
export class SiteModule { } 