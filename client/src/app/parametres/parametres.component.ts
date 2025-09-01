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
  settings: AppSettings = {};

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