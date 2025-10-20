import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RemindersListComponent } from './reminders-list.component';
import { ReminderNewComponent } from './reminder-new.component';
import { ReminderEditComponent } from './reminder-edit.component';

const routes: Routes = [
  { path: '', component: RemindersListComponent },
  { path: 'nouveau', component: ReminderNewComponent },
  { path: 'edit/:id', component: ReminderEditComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RemindersRoutingModule {}


