import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ExtraitParArticleComponent } from './extrait-par-article.component';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: ':depotId', component: ExtraitParArticleComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ExtraitParArticleRoutingModule { }

