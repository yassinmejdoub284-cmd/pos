import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService, AppSettings } from '../../../core/services/settings.service';

interface RoleCard {
  id: string;
  name: string;
  icon: string; // SVG path d attribute
  colorClass: string;
}

@Component({
  selector: 'app-access-role-selection',
  templateUrl: './access-role-selection.component.html',
  standalone: false
})
export class AccessRoleSelectionComponent implements OnInit {
  roles: RoleCard[] = [];

  appSettings: AppSettings | null = null;

  constructor(private router: Router, private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  private loadRoles(): void {
    this.settingsService.getSettings().subscribe(s => {
      this.appSettings = s;
      const existing = Object.keys(s.roleAccessConfig || {});
      this.roles = existing.map(id => ({
        id,
        name: (s.roleAccessConfig as any)?.[id]?.meta?.label || id,
        icon: (s.roleAccessConfig as any)?.[id]?.meta?.icon || 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
        colorClass: 'from-amber-400 to-yellow-500'
      }));
    });
  }

  openRole(role: RoleCard): void {
    this.router.navigate(['/parametres/access', role.id]);
  }

  addCustomRole(): void {
    const name = prompt('Nom du nouveau rôle');
    if (!name) return;
    const id = name.trim().toUpperCase().replace(/\s+/g, '_');
    if (!id) return;
    const current = this.appSettings?.roleAccessConfig || {};
    if ((current as any)[id]) {
      this.router.navigate(['/parametres/access', id]);
      return;
    }
    const updated = { ...(current as any), [id]: { blocks: {} } };
    this.settingsService.updateSettings({ roleAccessConfig: updated }).subscribe(() => {
      this.router.navigate(['/parametres/access', id]);
    });
  }

  getRoleColor(roleId: string): string {
    const color = (this.appSettings?.roleAccessConfig as any)?.[roleId]?.meta?.color;
    return typeof color === 'string' && color ? color : '#10b981';
  }

  getRoleIcon(roleId: string, fallback: string): string {
    const icon = (this.appSettings?.roleAccessConfig as any)?.[roleId]?.meta?.icon;
    return typeof icon === 'string' && icon ? icon : fallback;
  }

  editRole(e: MouseEvent, role: RoleCard): void {
    e.stopPropagation();
    this.router.navigate(['/parametres/access', role.id]);
  }

  deleteRole(e: MouseEvent, role: RoleCard): void {
    e.stopPropagation();
    if (!confirm(`Supprimer le rôle "${role.name}" ?`)) return;
    const current = (this.appSettings?.roleAccessConfig || {}) as any;
    const updated: any = { ...current };
    delete updated[role.id];
    this.settingsService.updateSettings({ roleAccessConfig: updated }).subscribe(() => {
      this.loadRoles();
    });
  }
}


