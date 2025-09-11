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
  denominationsInput = '';
  keyboardShortcutsInput = '';
  devicesConfigInput = '';
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
    droitDeTimbre: false,
    autoApproveExpenseBelow: 0
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
        this.denominationsInput = (this.settings.denominations || [])
          .map((n) => (typeof n === 'number' && !isNaN(n) ? n : Number(n)))
          .filter((n) => typeof n === 'number' && !isNaN(n))
          .join(', ');
        // JSON fields as strings for editable textarea
        try {
          this.keyboardShortcutsInput = this.settings.keyboardShortcuts ? JSON.stringify(this.settings.keyboardShortcuts, null, 2) : '';
        } catch { this.keyboardShortcutsInput = ''; }
        try {
          this.devicesConfigInput = this.settings.devicesConfig ? JSON.stringify(this.settings.devicesConfig, null, 2) : '';
        } catch { this.devicesConfigInput = ''; }
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
    // Ensure denominations are synced from input field
    this.settings.denominations = this.parseDenominations(this.denominationsInput);
    // Parse JSON inputs back to objects
    try {
      this.settings.keyboardShortcuts = this.keyboardShortcutsInput ? JSON.parse(this.keyboardShortcutsInput) : {};
    } catch {}
    try {
      this.settings.devicesConfig = this.devicesConfigInput ? JSON.parse(this.devicesConfigInput) : {};
    } catch {}
    // Coerce numeric fields to numbers to avoid sending strings/undefined
    this.settings.loyaltyRate = Number(this.settings.loyaltyRate) || 0;
    this.settings.maxDiscountPercent = Number(this.settings.maxDiscountPercent) || 0;
    this.settings.defaultClientMaxDebt = Number(this.settings.defaultClientMaxDebt) || 0;
    this.settings.auditRetentionDays = Number(this.settings.auditRetentionDays) || 0;
    this.settings.varianceThreshold = Number(this.settings.varianceThreshold) || 0;
    this.settings.defaultFonds = Number(this.settings.defaultFonds) || 0;
    this.settings.ticketWidth = Number(this.settings.ticketWidth) || 58;
    this.settings.autoApproveExpenseBelow = Number(this.settings.autoApproveExpenseBelow) || 0;
    this.settingsService.updateSettings(this.settings).subscribe({
      next: (s) => {
        this.settings = s;
        this.denominationsInput = (this.settings.denominations || []).join(', ');
        try { this.keyboardShortcutsInput = this.settings.keyboardShortcuts ? JSON.stringify(this.settings.keyboardShortcuts, null, 2) : ''; } catch {}
        try { this.devicesConfigInput = this.settings.devicesConfig ? JSON.stringify(this.settings.devicesConfig, null, 2) : ''; } catch {}
        this.saving = false;
      },
      error: () => {
        this.saving = false;
        this.error = "Erreur lors de l'enregistrement";
      }
    });
  }

  onDenominationsInput(value: string): void {
    this.denominationsInput = value;
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        this.settings.logoUrl = result; // store base64 for persistence
      }
    };
    reader.readAsDataURL(file);
  }

  private parseDenominations(raw: string): number[] {
    if (!raw) { return []; }
    return raw
      .split(',')
      .map((p) => Number(String(p).trim().replace(/\s+/g, '')))
      .filter((n) => !isNaN(n) && n >= 0)
      .sort((a, b) => b - a);
  }
} 