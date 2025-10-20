import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RemindersRoutingModule } from './reminders-routing.module';
import { RemindersListComponent } from './reminders-list.component';
import { ReminderNewComponent } from './reminder-new.component';
import { ReminderEditComponent } from './reminder-edit.component';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [],
  imports: [CommonModule, FormsModule, RemindersRoutingModule, RemindersListComponent, ReminderNewComponent, ReminderEditComponent]
})
export class RemindersModule {}


