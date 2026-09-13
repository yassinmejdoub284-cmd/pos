import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProductCommentsService } from '../../../core/services/product-comments.service';
import { ProductsService } from '../../../core/services/products.service';
import { ProductComment } from '../../../core/models/product-comment.model';

/**
 * Gestion des produits > Commentaires.
 *
 * Un commentaire global (aucun produit choisi) est propose pour tous les
 * produits. Un commentaire lie a un produit n'apparait que pour lui.
 * La caisse affiche cette grille des qu'un produit est ajoute au ticket, et
 * les commentaires retenus ne sont imprimes que sur le ticket cuisine.
 */
@Component({
  selector: 'app-product-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="p-4 sm:p-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Commentaires produits</h1>
        <p class="text-sm text-gray-500">
          Consignes de preparation proposees en caisse et imprimees uniquement sur le ticket cuisine.
        </p>
      </div>
      <a routerLink="/stock/products"
         class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
        Retour
      </a>
    </div>

    <div *ngIf="error()" class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{{ error() }}</div>

    <!-- Ajout -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <h2 class="font-semibold text-gray-800 mb-3">Nouveau commentaire</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="sm:col-span-1">
          <label class="block text-sm text-gray-600 mb-1">Libelle *</label>
          <input type="text" [(ngModel)]="newLabel" maxlength="60" placeholder="Ex: Sans sauce"
                 (keyup.enter)="add()"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div class="sm:col-span-1">
          <label class="block text-sm text-gray-600 mb-1">Produit</label>
          <select [(ngModel)]="newProductId" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option [ngValue]="null">Tous les produits (global)</option>
            <option *ngFor="let p of products()" [ngValue]="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="sm:col-span-1 flex items-end">
          <button (click)="add()" [disabled]="saving() || !newLabel.trim()"
                  class="w-full px-4 py-2 rounded-lg bg-teal-600 text-white font-medium disabled:opacity-50">
            Ajouter
          </button>
        </div>
      </div>
    </div>

    <!-- Liste -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div *ngIf="loading()" class="p-6 text-center text-gray-500">Chargement...</div>
      <div *ngIf="!loading() && comments().length === 0" class="p-6 text-center text-gray-500">
        Aucun commentaire. Ajoute par exemple « Sans sauce », « Sans oignon », « Bien cuit ».
      </div>
      <table *ngIf="!loading() && comments().length > 0" class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="text-left px-4 py-2">Libelle</th>
            <th class="text-left px-4 py-2">Produit</th>
            <th class="text-left px-4 py-2">Actif</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let c of comments()" class="border-t border-gray-100">
            <td class="px-4 py-2 font-medium text-gray-800">{{ c.label }}</td>
            <td class="px-4 py-2 text-gray-600">
              <span *ngIf="c.productId; else global">{{ c.product?.name || ('#' + c.productId) }}</span>
              <ng-template #global><span class="text-teal-700">Tous les produits</span></ng-template>
            </td>
            <td class="px-4 py-2">
              <button (click)="toggle(c)" class="px-2 py-1 rounded text-xs font-medium"
                      [class.bg-green-100]="c.isActive" [class.text-green-700]="c.isActive"
                      [class.bg-gray-100]="!c.isActive" [class.text-gray-500]="!c.isActive">
                {{ c.isActive ? 'Actif' : 'Masque' }}
              </button>
            </td>
            <td class="px-4 py-2 text-right">
              <button (click)="remove(c)" class="text-red-600 hover:text-red-800 text-xs font-medium">
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `
})
export class ProductCommentsComponent implements OnInit {
  comments = signal<ProductComment[]>([]);
  products = signal<{ id: number; name: string }[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');

  newLabel = '';
  newProductId: number | null = null;

  constructor(
    private commentsService: ProductCommentsService,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    this.load();
    this.productsService.getProducts().subscribe({
      next: (list: any[]) => this.products.set((list || []).map(p => ({ id: p.id, name: p.name }))),
      error: () => this.products.set([])
    });
  }

  load(): void {
    this.loading.set(true);
    this.commentsService.list(true).subscribe({
      next: (list) => { this.comments.set(list || []); this.loading.set(false); },
      error: (e) => { this.error.set(e?.error?.error || 'Chargement impossible'); this.loading.set(false); }
    });
  }

  add(): void {
    const label = this.newLabel.trim();
    if (!label) return;
    this.saving.set(true);
    this.error.set('');
    this.commentsService.create({ label, productId: this.newProductId }).subscribe({
      next: (created) => {
        this.comments.set([...this.comments(), created]);
        this.newLabel = '';
        this.saving.set(false);
      },
      error: (e) => { this.error.set(e?.error?.error || 'Creation impossible'); this.saving.set(false); }
    });
  }

  toggle(c: ProductComment): void {
    this.commentsService.update(c.id, { isActive: !c.isActive }).subscribe({
      next: (updated) => this.comments.set(this.comments().map(x => x.id === c.id ? updated : x)),
      error: (e) => this.error.set(e?.error?.error || 'Modification impossible')
    });
  }

  remove(c: ProductComment): void {
    this.commentsService.remove(c.id).subscribe({
      next: () => this.comments.set(this.comments().filter(x => x.id !== c.id)),
      error: (e) => this.error.set(e?.error?.error || 'Suppression impossible')
    });
  }
}
