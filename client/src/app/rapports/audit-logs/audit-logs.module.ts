import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AuditLogsRoutingModule } from './audit-logs-routing.module';
import { AuditLogsComponent } from './audit-logs.component';
import { AuditLogsService } from './audit-logs.service';
import { AuditTranslatorService } from './audit-translator.service';

@NgModule({
    declarations: [
        AuditLogsComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        HttpClientModule,
        AuditLogsRoutingModule
    ],
    providers: [
        AuditLogsService,
        AuditTranslatorService
    ]
})
export class AuditLogsModule { }
