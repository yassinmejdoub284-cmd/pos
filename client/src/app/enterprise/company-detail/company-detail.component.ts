import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EnterpriseService } from '../../core/services/enterprise.service';

interface Company {
  id: number;
  raisonSociale: string;
  formeJuridique: string;
  logoUrl?: string;
  brandColor: string;
  statut: 'Actif' | 'Archivé';
  tvaAssujetti: boolean;
  depotCount: number;
}

interface Depot {
  id: number;
  name: string;
  code: string;
  ville: string;
  statut: 'Actif' | 'Inactif';
  companyId?: number;
}

@Component({
  selector: 'app-company-detail',
  standalone: false,
  template: `
    <div class="space-y-6">
      <!-- En-tête Société -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center space-x-4">
            <button 
              (click)="goBack()"
              class="p-2 bg-gray-100 rounded-xl text-gray-600 hover:bg-gray-200 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <div class="flex items-center space-x-4">
              <div class="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" [style.background]="company.brandColor + '20'">
                <img *ngIf="company.logoUrl" [src]="company.logoUrl" [alt]="company.raisonSociale" class="w-10 h-10 object-contain rounded-xl">
                <svg *ngIf="!company.logoUrl" class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
              </div>
              <div>
                <h1 class="text-2xl font-bold text-gray-800">{{ company.raisonSociale }}</h1>
                <p class="text-gray-600">{{ company.formeJuridique }}</p>
              </div>
            </div>
          </div>
          
          <div class="flex items-center space-x-3">
            <button 
              (click)="editCompany()"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
              Modifier la Société
            </button>
          </div>
        </div>
        
          <!-- Informations Société -->
        <div class="flex flex-wrap gap-3">
          <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-xl text-sm font-medium">
            {{ company.statut }}
          </span>
          <span class="bg-green-100 text-green-700 px-3 py-1 rounded-xl text-sm font-medium">
            {{ company.depotCount }} Entrepôts
          </span>
          <span class="bg-purple-100 text-purple-700 px-3 py-1 rounded-xl text-sm font-medium">
            TVA {{ company.tvaAssujetti ? 'Oui' : 'Non' }}
          </span>
        </div>
      </div>
      
      <!-- Section Entrepôts -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-800">Entrepôts</h2>
          <button 
            (click)="assignDepot()"
            class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95">
            <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Assigner un Entrepôt
          </button>
        </div>
        
        <!-- Grille des Entrepôts -->
        <div *ngIf="assignedDepots.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            *ngFor="let depot of assignedDepots" 
            class="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-gray-200 shadow-sm">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-800">{{ depot.name }}</h3>
              <span class="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-medium"
                    [class]="depot.statut === 'Actif' ? 'text-green-600' : 'text-gray-500'">
                {{ depot.statut }}
              </span>
            </div>
            <div class="space-y-1 text-sm text-gray-600">
              <div class="flex items-center space-x-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                </svg>
                <span>{{ depot.code }}</span>
              </div>
              <div class="flex items-center space-x-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span>{{ depot.ville }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- État Vide -->
        <div *ngIf="assignedDepots.length === 0" class="text-center py-12">
          <div class="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-600 mb-2">Aucun entrepôt assigné</h3>
          <p class="text-gray-500 mb-6">Assignez des entrepôts existants à cette société pour commencer</p>
          <button 
            (click)="assignDepot()"
            class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95">
            <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Assigner un Entrepôt
          </button>
        </div>
      </div>
    </div>

    <!-- Assign Depot Dialog -->
    <app-assign-depot 
      *ngIf="showAssignDepot"
      [companyId]="company.id"
      (depotsAssigned)="onDepotsAssigned($event)"
      (dialogClosed)="onAssignDialogClosed()">
    </app-assign-depot>
  `
})
export class CompanyDetailComponent implements OnInit {
  company: Company = {
    id: 0,
    raisonSociale: '',
    formeJuridique: '',
    brandColor: '#3B82F6',
    statut: 'Actif',
    tvaAssujetti: false,
    depotCount: 0
  };
  
  assignedDepots: Depot[] = [];
  showAssignDepot = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private enterpriseService: EnterpriseService
  ) {}
  
  ngOnInit(): void {
    const companyId = this.route.snapshot.paramMap.get('id');
    if (companyId) {
      this.loadCompany(parseInt(companyId));
      this.loadAssignedDepots(parseInt(companyId));
    }
  }
  
  loadCompany(id: number): void {
    this.enterpriseService.getCompany(id).subscribe(c => {
      this.company = {
        id: c.id,
        raisonSociale: c.raisonSociale,
        formeJuridique: c.formeJuridique,
        logoUrl: c.logoUrl,
        brandColor: c.brandColor || '#3B82F6',
        statut: c.statut === 'ACTIF' ? 'Actif' : 'Archivé',
        tvaAssujetti: !!c.tvaAssujetti,
        depotCount: c.depots?.length ?? 0
      };
      this.assignedDepots = (c.depots || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        ville: d.city,
        statut: d.isActive ? 'Actif' : 'Inactif',
        companyId: c.id
      }));
    });
  }
  
  loadAssignedDepots(companyId: number): void {
    this.enterpriseService.getCompany(companyId).subscribe(c => {
      this.assignedDepots = (c.depots || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        ville: d.city,
        statut: d.isActive ? 'Actif' : 'Inactif',
        companyId: c.id
      }));
    });
  }
  
  goBack(): void {
    this.router.navigate(['/enterprise/companies']);
  }
  
  editCompany(): void {
    this.router.navigate(['/enterprise/companies', this.company.id, 'edit']);
  }
  
  assignDepot(): void {
    this.showAssignDepot = true;
  }

  onAssignDialogClosed(): void {
    this.showAssignDepot = false;
  }

  onDepotsAssigned(_: number[]): void {
    const id = this.company?.id;
    if (id) {
      this.loadCompany(id);
      this.loadAssignedDepots(id);
    }
    this.showAssignDepot = false;
  }
}
