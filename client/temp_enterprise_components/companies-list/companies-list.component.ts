import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EnterpriseService } from '../../core/services/enterprise.service';

interface Company {
  id: number;
  raisonSociale: string;
  formeJuridique: string;
  activite?: string;
  dateCreation: string;
  logoUrl?: string;
  brandColor: string;
  statut: 'Actif' | 'Archivé';
  siegeSocial: {
    adresse: string;
    ville: string;
    delegation: string;
    gouvernorat: string;
    codePostal: string;
  };
  telephone: string;
  email?: string;
  siteWeb?: string;
  matriculeFiscal: string;
  rne: string;
  registreCommerce?: string;
  tvaAssujetti: boolean;
  numeroTva?: string;
  tauxTva: number;
  capitalSocial: number;
  representantLegal?: {
    nom: string;
    cin: string;
  };
  rib?: string;
  banque?: string;
  bic?: string;
  depotCount: number;
}

@Component({
  selector: 'app-companies-list',
  standalone: false,
  template: `
    <div class="space-y-6">
      <!-- Barre supérieure -->
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h2 class="text-xl font-semibold text-gray-800">Sociétés</h2>
          <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
            {{ companies.length }} sociétés
          </span>
        </div>
        
        <div class="flex items-center space-x-4">
          <!-- Recherche -->
          <div class="relative">
            <input 
              type="text" 
              placeholder="Rechercher des sociétés..."
              [(ngModel)]="searchTerm"
              class="w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
            <svg class="absolute right-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          
          <!-- Bouton Nouvelle Société -->
          <button 
            routerLink="/enterprise/companies/new"
            class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-2 rounded-xl font-medium shadow-lg transition-all duration-200 active:scale-95">
            <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Nouvelle Société
          </button>
        </div>
      </div>
      
      <!-- Grille des Sociétés -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <!-- Carte Nouvelle Société -->
        <div 
          routerLink="/enterprise/companies/new"
          class="bg-white/60 border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[280px]">
          <div class="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-700 mb-2">Ajouter une Société</h3>
          <p class="text-sm text-gray-500 text-center">Créez une société et gérez ses entrepôts</p>
        </div>
        
          <!-- Cartes Société -->
        <div 
          *ngFor="let company of filteredCompanies" 
          class="bg-white/80 rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-200 active:scale-95 cursor-pointer"
          (click)="viewCompany(company.id)">
          
          <!-- En-tête Société -->
          <div class="relative h-24" [style.background]="company.brandColor + '20'">
            <div class="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
            <div class="absolute top-4 left-4">
              <div class="w-12 h-12 bg-white/90 rounded-xl flex items-center justify-center shadow-lg">
                <img *ngIf="company.logoUrl" [src]="company.logoUrl" [alt]="company.raisonSociale" class="w-8 h-8 object-contain rounded-lg">
                <svg *ngIf="!company.logoUrl" class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
              </div>
            </div>
            <div class="absolute top-4 right-4">
              <span class="bg-white/90 px-2 py-1 rounded-lg text-xs font-medium"
                    [class]="company.statut === 'Actif' ? 'text-green-600' : 'text-gray-500'">
                {{ company.statut }}
              </span>
            </div>
          </div>
          
          <!-- Contenu Société -->
          <div class="p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-2 line-clamp-2">{{ company.raisonSociale }}</h3>
            <p class="text-sm text-gray-600 mb-4">{{ company.formeJuridique }}</p>
            
            <!-- Mentions Légales -->
            <div class="flex flex-wrap gap-2 mb-4">
              <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs font-medium">
                MF : {{ company.matriculeFiscal }}
              </span>
              <span class="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-medium">
                RNE : {{ company.rne }}
              </span>
              <span class="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-medium">
                TVA : {{ company.tvaAssujetti ? 'Oui' : 'Non' }}
              </span>
            </div>
            
            <!-- Nombre de Entrepôts -->
            <div class="flex items-center text-sm text-gray-600 mb-4">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
              </svg>
              {{ company.depotCount }} Entrepôts
            </div>
          </div>
          
          <!-- Actions -->
          <div class="px-6 pb-6">
            <div class="flex space-x-2">
              <button 
                (click)="viewCompany(company.id); $event.stopPropagation()"
                class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2 px-4 rounded-xl font-medium text-sm">
                Ouvrir
              </button>
              <button 
                (click)="editCompany(company.id); $event.stopPropagation()"
                class="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">
                Modifier
              </button>
              <button 
                (click)="openMoreOptions(company); $event.stopPropagation()"
                class="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">
                Plus
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- État Vide -->
      <div *ngIf="filteredCompanies.length === 0 && searchTerm" class="text-center py-12">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <h3 class="text-lg font-semibold text-gray-600 mb-2">Aucune société trouvée</h3>
        <p class="text-gray-500 mb-4">Essayez d'ajuster vos termes de recherche</p>
        <button 
          (click)="searchTerm = ''"
          class="text-blue-600  font-medium">
          Effacer la recherche
        </button>
      </div>

      <!-- Dialog Actions: Archiver / Supprimer -->
      <div *ngIf="showMoreDialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200">
          <div class="p-6 border-b border-gray-100">
            <h3 class="text-lg font-bold text-gray-800">Actions pour {{ selectedCompany?.raisonSociale }}</h3>
            <p class="text-sm text-gray-500">Choisissez une action</p>
          </div>
          <div class="p-6 space-y-3">
            <button (click)="archiveSelected()" class="w-full bg-amber-50 text-amber-800 border border-amber-200 rounded-xl px-4 py-3 text-left font-medium">
              Archiver la société
            </button>
            <button (click)="deleteSelected()" class="w-full bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-left font-medium">
              Supprimer définitivement
            </button>
          </div>
          <div class="p-6 border-t border-gray-100 flex justify-end">
            <button (click)="closeMoreDialog()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CompaniesListComponent implements OnInit {
  companies: Company[] = [];
  searchTerm = '';
  showMoreDialog = false;
  selectedCompany: Company | null = null;
  constructor(private router: Router, private enterpriseService: EnterpriseService) {}
  
  ngOnInit(): void {
    this.loadCompanies();
  }
  
  get filteredCompanies(): Company[] {
    if (!this.searchTerm) return this.companies;
    
    const term = this.searchTerm.toLowerCase();
    return this.companies.filter(company => 
      company.raisonSociale.toLowerCase().includes(term) ||
      company.matriculeFiscal.toLowerCase().includes(term) ||
      company.rne.toLowerCase().includes(term) ||
      company.formeJuridique.toLowerCase().includes(term)
    );
  }
  
  loadCompanies(): void {
    this.enterpriseService.listCompanies().subscribe(companies => {
      this.companies = companies.map(c => ({
        id: c.id,
        raisonSociale: c.raisonSociale,
        formeJuridique: c.formeJuridique,
        activite: c.activite,
        dateCreation: c.dateCreation,
        logoUrl: c.logoUrl,
        brandColor: c.brandColor || '#3B82F6',
        statut: c.statut === 'ACTIF' ? 'Actif' : 'Archivé',
        siegeSocial: {
          adresse: c.adresse,
          ville: c.ville,
          delegation: c.delegation,
          gouvernorat: c.gouvernorat,
          codePostal: c.codePostal
        },
        telephone: c.telephone,
        email: c.email,
        siteWeb: c.siteWeb,
        matriculeFiscal: c.matriculeFiscal,
        rne: c.rne,
        registreCommerce: c.registreCommerce,
        tvaAssujetti: c.tvaAssujetti,
        numeroTva: c.numeroTva,
        tauxTva: Number(c.tauxTva),
        capitalSocial: Number(c.capitalSocial),
        representantLegal: {
          nom: c.representantNom,
          cin: c.representantCin
        },
        rib: c.rib,
        banque: c.banque,
        bic: c.bic,
        depotCount: c.depotCount ?? 0
      }));
    });
  }
  
  createNewCompany(): void {
    this.router.navigate(['/enterprise/companies/new']);
  }
  
  viewCompany(id: number): void {
    this.router.navigate(['/enterprise/companies', id]);
  }
  
  editCompany(id: number): void {
    this.router.navigate(['/enterprise/companies', id, 'edit']);
  }

  openMoreOptions(company: Company): void {
    this.selectedCompany = company;
    this.showMoreDialog = true;
  }

  closeMoreDialog(): void {
    this.showMoreDialog = false;
    this.selectedCompany = null;
  }

  archiveSelected(): void {
    if (!this.selectedCompany) return;
    this.enterpriseService.updateCompany(this.selectedCompany.id, { statut: 'ARCHIVE' }).subscribe(() => {
      this.closeMoreDialog();
      this.loadCompanies();
    });
  }

  deleteSelected(): void {
    if (!this.selectedCompany) return;
    this.enterpriseService.deleteCompany(this.selectedCompany.id).subscribe(() => {
      this.closeMoreDialog();
      this.loadCompanies();
    });
  }
}
