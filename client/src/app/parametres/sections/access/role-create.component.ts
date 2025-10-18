import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SettingsService, AppSettings } from '../../../core/services/settings.service';

@Component({
  selector: 'app-role-create',
  templateUrl: './role-create.component.html',
  standalone: false
})
export class RoleCreateComponent {
  label = '';
  color = '#10b981';
  selectedIcon = 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
  saving = false;
  error = '';
  private editingId: string | null = null;
  icons: string[] = [
    // 50+ SVG path d entries (outline, 24x24)
    'M3 7h18M3 7l3-4h12l3 4M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7',
    'M4 6h16M4 10h16M4 14h16M4 18h16',
    'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10',
    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    'M12 6v6m0 0v6m0-6h6m-6 0H6',
    'M5 13l4 4L19 7',
    'M9 17v-6h6v6m-6-10h6',
    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 21.5 12.083 12.083 0 015.84 10.578L12 14z',
    'M9 19v-6a2 2 0 00-2-2H5l7-7 7 7h-2a2 2 0 00-2 2v6',
    'M7 7h10M7 11h10M7 15h10',
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2',
    'M3 3h18v4H3zM3 9h18v12H3z',
    'M8 7V3h8v4M5 21h14v-8H5z',
    'M9 5a7 7 0 016 0m-9 4a7 7 0 0012 0',
    'M5 12h14M12 5l7 7-7 7-7-7 7-7z',
    'M4 4h16v16H4z',
    'M4 6h16M6 10h12M8 14h8M10 18h4',
    'M5 8h14M5 12h14M5 16h14',
    'M6 18L18 6M6 6l12 12',
    'M12 2a10 10 0 100 20 10 10 0 000-20z',
    'M5 13l4 4L19 7M5 7h14v10H5z',
    'M3 7h18M6 10h12M7 13h10M8 16h8',
    'M4 4l16 16M4 20L20 4',
    'M3 12h18M12 3v18',
    'M9 12h6m-6 4h6M7 8h10',
    'M5 3h14a2 2 0 012 2v14H3V5a2 2 0 012-2z',
    'M8 21h8M12 17v4',
    'M9 12l2 2 4-4',
    'M11 5h2M6 8h12M6 12h12M6 16h12',
    'M6 9l6 6 6-6',
    'M6 15l6-6 6 6',
    'M12 5v14M5 12h14',
    'M4 8h16l-2 10H6L4 8z',
    'M6 6h12v12H6zM9 9h6v6H9z',
    'M4 7h16M7 10h10M9 13h6M11 16h2',
    'M8 6h8v2H8zM8 10h8v2H8zM8 14h8v2H8z',
    'M5 5h14M5 9h14M5 13h14M5 17h14',
    'M7 7h10v10H7z',
    'M9 7h6v6H9z',
    'M5 11h14M12 5l7 6-7 6-7-6 7-6z',
    'M10 6h4v12h-4z',
    'M6 10h12M6 14h12',
    'M8 8h8M6 12h12M10 16h4',
    'M12 6l6 6-6 6-6-6 6-6z',
    'M6 6l12 12M6 18L18 6',
    'M9 4h6v16H9z',
    'M7 4h10v4H7zM7 10h10v10H7z'
  ];

  constructor(private settingsService: SettingsService, private router: Router, private route: ActivatedRoute) {
    this.route.paramMap.subscribe(params => {
      const editId = params.get('id');
      this.editingId = editId;
      if (editId) {
        this.settingsService.getSettings().subscribe(s => {
          const meta = (s.roleAccessConfig as any)?.[editId]?.meta;
          if (meta) {
            this.label = meta.label || editId;
            this.color = meta.color || this.color;
            this.selectedIcon = meta.icon || this.selectedIcon;
          }
        });
      }
    });
  }

  get normalizedKey(): string {
    return this.normalizeKey(this.label || '');
  }

  get isEditing(): boolean {
    return !!this.editingId;
  }

  get currentKey(): string {
    return this.editingId || this.normalizedKey;
  }

  private normalizeKey(input: string): string {
    return input.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_');
  }

  onLabelChange(value: string): void {
    this.label = value;
  }

  submit(): void {
    this.error = '';
    const roleKey = this.editingId || this.normalizedKey;
    if (!roleKey) {
      this.error = 'Veuillez saisir un libellé ou une clé valides';
      return;
    }
    this.saving = true;
    this.settingsService.getSettings().subscribe(settings => {
      const current = settings.roleAccessConfig || {};
      const updated = { ...(current as any), [roleKey]: { ...(current as any)[roleKey], blocks: (current as any)[roleKey]?.blocks || {}, meta: { label: this.label || roleKey, color: this.color, icon: this.selectedIcon } } };
      this.settingsService.updateSettings({ roleAccessConfig: updated }).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/parametres/access', roleKey]);
        },
        error: () => {
          this.saving = false;
          this.error = 'Erreur enregistrement du rôle';
        }
      });
    });
  }
}


