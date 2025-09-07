import { Component, OnInit } from '@angular/core';
import { SettingsService, AppSettings } from '../core/services/settings.service';

@Component({
  selector: 'app-parametres',
  templateUrl: './parametres.component.html',
  standalone: false
})
export class ParametresComponent implements OnInit {
  loading = false;
  saving = false;
  error = '';
  settings: AppSettings = {
    loyaltyEnabled: false,
    loyaltyRate: 1,
    maxDiscountPercent: 50,
    defaultClientMaxDebt: 0,
    auditRetentionDays: 90,
    varianceThreshold: 5.0,
    defaultFonds: 0.0,
    denominations: [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
    requireApprovalForVariance: true,
    ticketWidth: 58,
    droitDeTimbre: false
  };

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.settings = s || {};
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = "Erreur lors du chargement des paramètres";
      }
    });
  }

  save(): void {
    this.saving = true;
    this.settingsService.updateSettings(this.settings).subscribe({
      next: (s) => {
        this.settings = s;
        this.saving = false;
      },
      error: () => {
        this.saving = false;
        this.error = "Erreur lors de l'enregistrement";
      }
    });
  }
} 