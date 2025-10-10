import { NgModule } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SessionsHistoryComponent } from './sessions-history.component';

const routes: Routes = [
  { path: '', component: SessionsHistoryComponent }
];

@NgModule({
  declarations: [SessionsHistoryComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
  providers: [DatePipe, DecimalPipe]
})
export class SessionsHistoryModule {}


