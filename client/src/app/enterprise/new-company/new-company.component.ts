import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EnterpriseService } from '../../core/services/enterprise.service';

@Component({
  selector: 'app-new-company',
  standalone: false,
  template: `
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center space-x-4 mb-4">
          <button 
            (click)="goBack()"
            class="p-2 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h1 class="text-2xl font-bold text-gray-800">Nouvelle Société</h1>
        </div>
        <p class="text-gray-600">Créez une nouvelle société et configurez ses informations légales</p>
      </div>
      
      <form [formGroup]="companyForm" (ngSubmit)="onSubmit()" class="space-y-8">
        <!-- Identity Section -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
          <div class="flex items-center space-x-3 mb-6">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-800">Identité</h2>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Raison sociale *</label>
              <input 
                type="text" 
                formControlName="raisonSociale"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                placeholder="Enter company name">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Forme juridique *</label>
              <select 
                formControlName="formeJuridique"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
                <option value="">Sélectionner une forme</option>
                <option value="SARL">SARL</option>
                <option value="SUARL">SUARL</option>
                <option value="SA">SA</option>
                <option value="SNC">SNC</option>
                <option value="SAS">SAS</option>
                <option value="EURL">EURL</option>
                <option value="Auto-entrepreneur">Auto-entrepreneur</option>
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Activité / Code NACE</label>
              <input 
                type="text" 
                formControlName="activite"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                placeholder="Business activity">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Date de création *</label>
              <input 
                type="date" 
                formControlName="dateCreation"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Image/Logo</label>
              <div class="flex items-center space-x-4">
                <div class="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                  <img *ngIf="companyForm.get('logoUrl')?.value" [src]="companyForm.get('logoUrl')?.value" alt="Logo" class="w-full h-full object-contain" />
                  <svg *ngIf="!companyForm.get('logoUrl')?.value" class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <input type="file" accept="image/*" (change)="onLogoSelected($event)" class="hidden" #logoInput>
                <button type="button" (click)="logoInput.click()" class="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl font-medium text-sm">
                  Importer un Logo
                </button>
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Couleur de Marque</label>
              <div class="flex items-center space-x-3">
                <input 
                  type="color" 
                  formControlName="brandColor"
                  value="#3B82F6"
                  class="w-12 h-12 border border-gray-200 rounded-xl cursor-pointer">
                <input 
                  type="text" 
                  formControlName="brandColor"
                  class="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="#3B82F6">
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Statut *</label>
              <select 
                formControlName="statut"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
                <option value="Actif">Actif</option>
                <option value="Archivé">Archivé</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Coordonnées -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
          <div class="flex items-center space-x-3 mb-6">
            <div class="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-800">Coordonnées</h2>
          </div>
          
          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Siège social</label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="text" 
                  formControlName="adresse"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="Adresse">
                <input 
                  type="text" 
                  formControlName="ville"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="Ville">
                <input 
                  type="text" 
                  formControlName="delegation"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="Délégation">
                <input 
                  type="text" 
                  formControlName="gouvernorat"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="Gouvernorat">
                <input 
                  type="text" 
                  formControlName="codePostal"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="Code postal">
              </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Téléphone *</label>
                <input 
                  type="tel" 
                  formControlName="telephone"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="+216 71 123 456">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input 
                  type="email" 
                  formControlName="email"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="contact@company.tn">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Site web</label>
                <input 
                  type="url" 
                  formControlName="siteWeb"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="www.company.tn">
              </div>
            </div>
          </div>
        </div>
        
        <!-- Légal (Tunisie) -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
          <div class="flex items-center space-x-3 mb-6">
            <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-800">Légal (Tunisie)</h2>
          </div>
          
          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Matricule fiscale (MF) *</label>
                <input 
                  type="text" 
                  formControlName="matriculeFiscal"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="1260304/S/A/M/000">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">RNE / Identifiant Unique *</label>
                <input 
                  type="text" 
                  formControlName="rne"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="TN123456789">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Registre de commerce (RC)</label>
                <input 
                  type="text" 
                  formControlName="registreCommerce"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="RC123456">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Capital social (DT)</label>
                <input 
                  type="number" 
                  formControlName="capitalSocial"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  placeholder="100000">
              </div>
            </div>
            
            <!-- TVA Section -->
            <div class="border-t border-gray-200 pt-6">
              <div class="flex items-center space-x-3 mb-4">
                <label class="flex items-center space-x-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    formControlName="tvaAssujetti"
                    class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                  <span class="text-sm font-medium text-gray-700">TVA Assujetti</span>
                </label>
              </div>
              
              <div *ngIf="companyForm.get('tvaAssujetti')?.value" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Numéro TVA</label>
                  <input 
                    type="text" 
                    formControlName="numeroTva"
                    class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    placeholder="TN1260304S">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Taux par défaut (%)</label>
                  <input 
                    type="number" 
                    formControlName="tauxTva"
                    class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    placeholder="19">
                </div>
              </div>
            </div>
            
            <!-- Représentant légal -->
            <div class="border-t border-gray-200 pt-6">
              <h3 class="text-lg font-medium text-gray-800 mb-4">Représentant légal</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                  <input 
                    type="text" 
                    formControlName="representantNom"
                    class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    placeholder="Full name">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">CIN</label>
                  <input 
                    type="text" 
                    formControlName="representantCin"
                    class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    placeholder="12345678">
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Bancaire Section -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg">
          <div class="flex items-center space-x-3 mb-6">
            <div class="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
              </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-800">Bancaire (facultatif)</h2>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">RIB/IBAN TN</label>
              <input 
                type="text" 
                formControlName="rib"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                placeholder="TN5900100000000000000001">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Banque</label>
              <input 
                type="text" 
                formControlName="banque"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                placeholder="STB">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">BIC</label>
              <input 
                type="text" 
                formControlName="bic"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                placeholder="STBKTNTT">
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex items-center justify-end space-x-4">
          <button 
            type="button"
            (click)="goBack()"
            class="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
            Annuler
          </button>
          <button 
            type="submit"
            [disabled]="companyForm.invalid"
            class="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            Créer
          </button>
        </div>
      </form>
    </div>
  `
})
export class NewCompanyComponent implements OnInit {
  companyForm: FormGroup;
  editId: number | null = null;
  
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private enterpriseService: EnterpriseService
  ) {
    this.companyForm = this.fb.group({
      // Identity
      raisonSociale: ['', Validators.required],
      formeJuridique: ['', Validators.required],
      activite: [''],
      dateCreation: ['', Validators.required],
      logoUrl: [''],
      brandColor: ['#3B82F6'],
      statut: ['Actif', Validators.required],
      
      // Coordonnées
      adresse: [''],
      ville: [''],
      delegation: [''],
      gouvernorat: [''],
      codePostal: [''],
      telephone: ['', Validators.required],
      email: [''],
      siteWeb: [''],
      
      // Légal
      matriculeFiscal: ['', Validators.required],
      rne: ['', Validators.required],
      registreCommerce: [''],
      tvaAssujetti: [false],
      numeroTva: [''],
      tauxTva: [19],
      capitalSocial: [0],
      representantNom: [''],
      representantCin: [''],
      
      // Bancaire
      rib: [''],
      banque: [''],
      bic: ['']
    });
  }
  
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = parseInt(id);
      this.enterpriseService.getCompany(this.editId).subscribe(c => {
        this.companyForm.patchValue({
          raisonSociale: c.raisonSociale,
          formeJuridique: c.formeJuridique,
          activite: c.activite,
          dateCreation: c.dateCreation ? c.dateCreation.substring(0,10) : '',
          logoUrl: c.logoUrl,
          brandColor: c.brandColor || '#3B82F6',
          statut: c.statut === 'ACTIF' ? 'Actif' : 'Archivé',
          adresse: c.adresse,
          ville: c.ville,
          delegation: c.delegation,
          gouvernorat: c.gouvernorat,
          codePostal: c.codePostal,
          telephone: c.telephone,
          email: c.email,
          siteWeb: c.siteWeb,
          matriculeFiscal: c.matriculeFiscal,
          rne: c.rne,
          registreCommerce: c.registreCommerce,
          tvaAssujetti: !!c.tvaAssujetti,
          numeroTva: c.numeroTva,
          tauxTva: Number(c.tauxTva ?? 19),
          capitalSocial: Number(c.capitalSocial ?? 0),
          representantNom: c.representantNom,
          representantCin: c.representantCin,
          rib: c.rib,
          banque: c.banque,
          bic: c.bic
        });
      });
    }
  }
  
  onSubmit(): void {
    if (this.companyForm.valid) {
      const v = this.companyForm.value;
      const payload = {
        raisonSociale: v.raisonSociale,
        formeJuridique: v.formeJuridique,
        activite: v.activite,
        dateCreation: v.dateCreation ? new Date(v.dateCreation).toISOString() : null,
        logoUrl: v.logoUrl,
        brandColor: v.brandColor,
        statut: v.statut === 'Actif' ? 'ACTIF' : 'ARCHIVE',
        adresse: v.adresse,
        ville: v.ville,
        delegation: v.delegation,
        gouvernorat: v.gouvernorat,
        codePostal: v.codePostal,
        telephone: v.telephone,
        email: v.email,
        siteWeb: v.siteWeb,
        matriculeFiscal: v.matriculeFiscal,
        rne: v.rne,
        registreCommerce: v.registreCommerce,
        tvaAssujetti: !!v.tvaAssujetti,
        numeroTva: v.numeroTva,
        tauxTva: Number(v.tauxTva ?? 19),
        capitalSocial: Number(v.capitalSocial ?? 0),
        representantNom: v.representantNom,
        representantCin: v.representantCin,
        rib: v.rib,
        banque: v.banque,
        bic: v.bic
      } as any;
      const obs = this.editId 
        ? this.enterpriseService.updateCompany(this.editId, payload)
        : this.enterpriseService.createCompany(payload);
      obs.subscribe(() => this.router.navigate(['/enterprise/companies']));
    }
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    if (this.editId) {
      this.enterpriseService.uploadCompanyLogoAndSave(this.editId, file).subscribe(({ logoUrl }) => {
        this.companyForm.patchValue({ logoUrl });
      });
    } else {
      this.enterpriseService.uploadCompanyLogo(file).subscribe(({ logoUrl }) => {
        this.companyForm.patchValue({ logoUrl });
      });
    }
  }
  
  goBack(): void {
    this.router.navigate(['/enterprise/companies']);
  }
}
