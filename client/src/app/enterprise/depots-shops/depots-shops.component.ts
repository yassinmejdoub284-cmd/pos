import { Component, OnInit } from '@angular/core';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';
import { EnterpriseService } from '../../core/services/enterprise.service';

@Component({
  selector: 'app-depots-shops',
  standalone: false,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a routerLink="/home" class="px-3 py-2 rounded-lg bg-gray-100 text-sm flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/></svg>
            Accueil
          </a>
          <h2 class="text-xl font-bold text-gray-800">Entrepôts & Magasins</h2>
        </div>
        <div class="space-x-2">
          <button routerLink="/enterprise/depots/new"
                  class="px-4 py-2 rounded-lg bg-indigo-600 text-white">Ajouter</button>
        </div>
      </div>

      <!-- Filters and create form -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="text-xs text-gray-500">Type</label>
            <select [(ngModel)]="filterType" class="mt-1 w-full border-gray-300 rounded-lg">
              <option value="ALL">Tous</option>
              <option value="WAREHOUSE">Entrepôt</option>
              <option value="SHOP">Magasin</option>
              <option value="BRANCH">Succursale</option>
              <option value="MAIN">Principal</option>
            </select>
          </div>
          <div></div>
          <div class="flex items-end">
            <button (click)="refresh()" [disabled]="loading" class="w-full px-4 py-2 rounded-lg bg-gray-100">Rafraîchir</button>
          </div>
        </div>
        <div class="p-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <input [(ngModel)]="newDepot.name" placeholder="Nom" class="w-full border-gray-300 rounded-lg" />
          </div>
          <div>
            <input [(ngModel)]="newDepot.code" placeholder="Code" class="w-full border-gray-300 rounded-lg" />
          </div>
          <div>
            <select [(ngModel)]="newDepot.type" class="w-full border-gray-300 rounded-lg">
              <option value="WAREHOUSE">Entrepôt</option>
              <option value="SHOP">Magasin</option>
              <option value="BRANCH">Succursale</option>
              <option value="MAIN">Principal</option>
            </select>
          </div>
          <div>
            <input [(ngModel)]="newDepot.address" placeholder="Adresse" class="w-full border-gray-300 rounded-lg" />
          </div>
          <div>
            <input [(ngModel)]="newDepot.city" placeholder="Ville" class="w-full border-gray-300 rounded-lg" />
          </div>
          <div class="hidden"></div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-gray-100 flex items-center justify-between">
          <span class="text-sm text-gray-600">Total: {{ filteredDepots.length }}</span>
        </div>
        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div *ngFor="let depot of filteredDepots" class="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col gap-3">
            <div class="flex items-start justify-between">
              <div>
                <div class="text-base font-semibold text-gray-800">{{ depot.name }}</div>
                <div class="text-xs text-gray-500">Code: {{ depot.code }}</div>
              </div>
              <div class="text-xs px-2 py-1 rounded-full"
                   [ngClass]="depot.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'">
                {{ depot.isActive ? 'Actif' : 'Inactif' }}
              </div>
            </div>
            <div class="text-sm text-gray-600">
              <div class="flex items-center gap-2">
                <span class="px-2 py-1 rounded-lg text-xs" [ngClass]="{
                  'bg-indigo-50 text-indigo-700': depot.type==='WAREHOUSE',
                  'bg-emerald-50 text-emerald-700': depot.type==='SHOP',
                  'bg-amber-50 text-amber-700': depot.type==='BRANCH',
                  'bg-purple-50 text-purple-700': depot.type==='MAIN'
                }">{{ depot.type }}</span>
                <span class="text-gray-400">•</span>
                <span>{{ depot.address || '—' }}<span *ngIf="depot.city">, {{ depot.city }}</span></span>
              </div>
              <div class="text-xs text-gray-500 mt-1">{{ depot.phone || '—' }} • {{ depot.email || '—' }}</div>
            </div>
            <div class="mt-auto flex items-center justify-between">
              <div class="flex gap-2">
                <button (click)="toggleActive(depot)" class="px-3 py-1 rounded-lg bg-gray-100 text-xs">Basculer</button>
              </div>
              <div class="flex gap-2">
                <a [routerLink]="['/enterprise/depots', depot.id, 'edit']" class="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs">Modifier</a>
                <button (click)="delete(depot)" class="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DepotsShopsComponent implements OnInit {
  depots: Depot[] = [];
  filterType: 'ALL' | 'WAREHOUSE' | 'SHOP' | 'BRANCH' | 'MAIN' = 'ALL';
  loading = false;
  creating = false;
  newDepot: Partial<Depot> & { companyId?: number | null } = {
    name: '',
    code: '',
    type: 'WAREHOUSE',
    address: '',
    city: '',
    isActive: true,
    companyId: null
  } as any;
  editingId: number | null = null;
  draft: Partial<Depot> = {};

  constructor(private depotsService: DepotsService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.depotsService.list().subscribe({
      next: (data) => { this.depots = data || []; this.loading = false; },
      error: () => { this.depots = []; this.loading = false; }
    });
  }

  get filteredDepots(): Depot[] {
    return this.depots.filter(d => (this.filterType === 'ALL' ? true : d.type === this.filterType));
  }

  createDepot(): void {
    if (!this.newDepot.name || !this.newDepot.code) return;
    this.creating = true;
    this.depotsService.create(this.newDepot).subscribe({
      next: () => { this.creating = false; this.resetForm(); this.refresh(); },
      error: () => { this.creating = false; }
    });
  }

  toggleActive(depot: Depot): void {
    this.depotsService.update(depot.id, { isActive: !depot.isActive }).subscribe({
      next: (updated) => { depot.isActive = updated.isActive; },
      error: () => {}
    });
  }

  startEdit(depot: Depot): void {
    this.editingId = depot.id;
    this.draft = { ...depot };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.draft = {};
  }

  saveEdit(depot: Depot): void {
    const payload: Partial<Depot> = {
      name: this.draft.name,
      code: this.draft.code,
      type: this.draft.type,
      address: this.draft.address,
      city: this.draft.city,
      phone: this.draft.phone,
      email: this.draft.email,
      isActive: this.draft.isActive
    };
    this.depotsService.update(depot.id, payload as any).subscribe({
      next: (updated) => {
        Object.assign(depot, updated);
        this.cancelEdit();
      },
      error: () => {}
    });
  }

  delete(depot: Depot): void {
    if (!confirm(`Supprimer ${depot.name} ?`)) return;
    this.depotsService.delete(depot.id).subscribe({
      next: () => { this.depots = this.depots.filter(d => d.id !== depot.id); },
      error: () => {}
    });
  }

  resetForm(): void {
    this.newDepot = { name: '', code: '', type: 'WAREHOUSE', address: '', city: '', isActive: true, companyId: null } as any;
  }
}


