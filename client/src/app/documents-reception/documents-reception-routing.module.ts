import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocumentsReceptionComponent } from './documents-reception.component';

const routes: Routes = [
  { path: '', component: DocumentsReceptionComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DocumentsReceptionRoutingModule {}


