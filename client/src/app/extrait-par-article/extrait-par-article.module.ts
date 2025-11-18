import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { ExtraitParArticleComponent } from './extrait-par-article.component';
import { ExtraitParArticleRoutingModule } from './extrait-par-article-routing.module';

@NgModule({
  declarations: [ExtraitParArticleComponent],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    ExtraitParArticleRoutingModule
  ]
})
export class ExtraitParArticleModule { }

