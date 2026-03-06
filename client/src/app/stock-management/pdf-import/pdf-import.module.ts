import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { PdfImportComponent } from './pdf-import.component';

const routes: Routes = [
  { path: '', component: PdfImportComponent }
];

@NgModule({
  declarations: [PdfImportComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class PdfImportModule { }
