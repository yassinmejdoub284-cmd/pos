import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';

@Component({
  selector: 'app-depot-editor',
  standalone: false,
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="mb-6 flex items-center gap-3">
        <button (click)="goBack()" class="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">Retour</button>
        <h1 class="text-xl font-semibold text-gray-800">{{ editId ? 'Modifier Entrepôt' : 'Nouvel Entrepôt' }}</h1>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <!-- Type chooser -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Type d'entrepôt *</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup" aria-label="Type d'entrepôt">
            <button type="button"
                    class="group relative rounded-xl border p-4 text-left transition-all"
                    [ngClass]="form.get('type')?.value==='WAREHOUSE' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'"
                    role="radio" [attr.aria-checked]="form.get('type')?.value==='WAREHOUSE'"
                    (click)="form.get('type')?.setValue('WAREHOUSE')">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg grid place-items-center"
                     [ngClass]="form.get('type')?.value==='WAREHOUSE' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10l9-6 9 6v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
                </div>
                <div>
                  <div class="font-semibold text-gray-800">Entrepôt</div>
                  <div class="text-xs text-gray-500">Stock principal</div>
                </div>
              </div>
            </button>

            <button type="button"
                    class="group relative rounded-xl border p-4 text-left transition-all"
                    [ngClass]="form.get('type')?.value==='SHOP' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'"
                    role="radio" [attr.aria-checked]="form.get('type')?.value==='SHOP'"
                    (click)="form.get('type')?.setValue('SHOP')">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg grid place-items-center"
                     [ngClass]="form.get('type')?.value==='SHOP' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l1-5h16l1 5"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M9 13h6v6H9z"/></svg>
                </div>
                <div>
                  <div class="font-semibold text-gray-800">Magasin</div>
                  <div class="text-xs text-gray-500">Point de vente</div>
                </div>
              </div>
            </button>

            <button type="button"
                    class="group relative rounded-xl border p-4 text-left transition-all"
                    [ngClass]="form.get('type')?.value==='BRANCH' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'"
                    role="radio" [attr.aria-checked]="form.get('type')?.value==='BRANCH'"
                    (click)="form.get('type')?.setValue('BRANCH')">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg grid place-items-center"
                     [ngClass]="form.get('type')?.value==='BRANCH' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 3v6a6 6 0 0 0 6 6h6"/><path d="M18 21v-6a6 6 0 0 0-6-6H6"/></svg>
                </div>
                <div>
                  <div class="font-semibold text-gray-800">Succursale</div>
                  <div class="text-xs text-gray-500">Site secondaire</div>
                </div>
              </div>
            </button>

            <button type="button"
                    class="group relative rounded-xl border p-4 text-left transition-all"
                    [ngClass]="form.get('type')?.value==='MAIN' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'"
                    role="radio" [attr.aria-checked]="form.get('type')?.value==='MAIN'"
                    (click)="form.get('type')?.setValue('MAIN')">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg grid place-items-center"
                     [ngClass]="form.get('type')?.value==='MAIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>
                </div>
                <div>
                  <div class="font-semibold text-gray-800">Principal</div>
                  <div class="text-xs text-gray-500">Siège</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-sm text-gray-700">Nom *</label>
            <input formControlName="name" class="mt-1 w-full border-gray-300 rounded-lg" placeholder="Nom de l'entrepôt" />
          </div>
          <div>
            <label class="text-sm text-gray-700">Code *</label>
            <input formControlName="code" class="mt-1 w-full border-gray-300 rounded-lg" placeholder="Code" />
          </div>
          <div>
            <label class="text-sm text-gray-700">Ville</label>
            <input formControlName="city" class="mt-1 w-full border-gray-300 rounded-lg" placeholder="Ville" />
          </div>
          <div class="md:col-span-2">
            <label class="text-sm text-gray-700">Adresse</label>
            <input formControlName="address" class="mt-1 w-full border-gray-300 rounded-lg" placeholder="Adresse" />
          </div>
          <div>
            <label class="text-sm text-gray-700">Téléphone</label>
            <input formControlName="phone" class="mt-1 w-full border-gray-300 rounded-lg" placeholder="Téléphone" />
          </div>
          <div>
            <label class="text-sm text-gray-700">Email</label>
            <input formControlName="email" class="mt-1 w-full border-gray-300 rounded-lg" placeholder="Email" />
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" (click)="goBack()" class="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">Annuler</button>
          <button type="submit" [disabled]="form.invalid" class="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">{{ editId ? 'Enregistrer' : 'Créer' }}</button>
        </div>
      </form>
    </div>
  `
})
export class DepotEditorComponent implements OnInit {
  form: FormGroup;
  editId: number | null = null;

  constructor(private fb: FormBuilder, private depots: DepotsService, private router: Router, private route: ActivatedRoute) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      type: ['WAREHOUSE', Validators.required],
      address: ['', Validators.required],
      city: ['', Validators.required],
      phone: [''],
      email: ['']
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = parseInt(id, 10);
      this.depots.get(this.editId).subscribe((d: Depot) => {
        this.form.patchValue({
          name: d.name,
          code: d.code,
          type: d.type,
          address: d.address,
          city: d.city,
          phone: (d as any).phone,
          email: (d as any).email
        });
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.value as Partial<Depot> & { phone?: string; email?: string };
    const obs = this.editId ? this.depots.update(this.editId, value as any) : this.depots.create(value as any);
    obs.subscribe(() => this.router.navigate(['/enterprise/depots-shops']));
  }

  goBack(): void {
    this.router.navigate(['/enterprise/depots-shops']);
  }
}


