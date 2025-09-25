import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DepotEditorComponent } from './depot-editor.component';

const routes: Routes = [
  { path: '', component: DepotEditorComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DepotEditorRoutingModule {}



