import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { TransportSelectorComponent } from './transport.selector.component';

const routes: Routes = [
  { path: '', component: TransportSelectorComponent }
];

@NgModule({
  declarations: [TransportSelectorComponent],
  imports: [CommonModule, RouterModule.forChild(routes)]
})
export class TransportModule {}
