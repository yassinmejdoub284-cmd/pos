import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NewReturnComponent } from './new-return.component';

const routes: Routes = [
  { path: '', component: NewReturnComponent }
];

@NgModule({
  declarations: [NewReturnComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule.forChild(routes)]
})
export class NewReturnModule {}
