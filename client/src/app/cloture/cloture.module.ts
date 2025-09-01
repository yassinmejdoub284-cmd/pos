import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClotureRoutingModule } from './cloture-routing.module';
import { ClotureComponent } from './cloture.component';

@NgModule({
  declarations: [ClotureComponent],
  imports: [
    CommonModule,
    ClotureRoutingModule
  ]
})
export class ClotureModule { }
