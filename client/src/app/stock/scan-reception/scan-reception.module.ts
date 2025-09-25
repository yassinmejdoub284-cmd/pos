import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { ScanReceptionComponent } from './scan-reception.component';

const routes: Routes = [
  { path: '', component: ScanReceptionComponent }
];

@NgModule({
  declarations: [ScanReceptionComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)]
})
export class ScanReceptionModule {}


