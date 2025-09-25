import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NewCompanyComponent } from '../new-company/new-company.component';
import { CompanyEditorRoutingModule } from './company-editor-routing.module';

@NgModule({
  declarations: [NewCompanyComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, CompanyEditorRoutingModule]
})
export class CompanyEditorModule {}



