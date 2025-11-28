import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormArray, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { Product, ProductFamily } from '../../../core/models/product.model';

interface TransferItem {
  targetProductId: number;
  quantity: number;
  conversionRatio: number;
}

@Component({
  selector: 'app-multi-transfer-form',
  templateUrl: './multi-transfer-form.component.html',
  standalone: false
})
export class MultiTransferFormComponent implements OnInit {
  @Input() sourceProduct: Product | null = null;
  @Output() transferred = new EventEmitter<TransferItem[]>();
  @Output() cancelled = new EventEmitter<void>();

  transferForm: FormGroup;
  targetProducts: Product[] = [];
  families: ProductFamily[] = [];
  loading = false;
  error = '';
  jusVracFamilyId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService
  ) {
    this.transferForm = this.fb.group({
      transferItems: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadFamilies();
  }

  get transferItems(): FormArray {
    return this.transferForm.get('transferItems') as FormArray;
  }

  loadFamilies(): void {
    this.productsService.getFamilles().subscribe({
      next: (families) => {
        this.families = families;
        const jusVracFamily = families.find(f => 
          f.name === 'JUS VRAC' || 
          f.name.toUpperCase() === 'JUS VRAC'
        );
        if (jusVracFamily) {
          this.jusVracFamilyId = jusVracFamily.id;
          this.loadTargetProducts();
        } else {
          this.error = 'Famille JUS VRAC non trouvée';
        }
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des familles';
      }
    });
  }

  loadTargetProducts(): void {
    if (!this.jusVracFamilyId) return;

    this.loading = true;
    this.error = '';

    const userDepotId = parseInt(sessionStorage.getItem('visitingDepotId') || sessionStorage.getItem('depotId') || '0');

    this.productsService.getProducts(userDepotId || undefined).subscribe({
      next: (products) => {
        this.targetProducts = products.filter(product => 
          product.familleId === this.jusVracFamilyId && 
          product.id !== this.sourceProduct?.id
        );
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loading = false;
      }
    });
  }

  addTransferItem(): void {
    const itemForm = this.fb.group({
      targetProductId: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
      conversionRatio: [1, [Validators.required, Validators.min(0.001)]]
    });

    this.transferItems.push(itemForm);
  }

  removeTransferItem(index: number): void {
    this.transferItems.removeAt(index);
  }

  getTargetQuantity(control: any): number {
    const item = control as FormGroup;
    const quantity = item.get('quantity')?.value || 0;
    const ratio = item.get('conversionRatio')?.value || 1;
    return quantity * ratio;
  }

  getTargetProductName(control: any): string {
    const item = control as FormGroup;
    const targetProductId = item.get('targetProductId')?.value;
    if (!targetProductId) return '';
    const product = this.targetProducts.find(p => p.id === targetProductId);
    return product?.name || '';
  }

  getTargetProductUnite(control: any): string {
    const item = control as FormGroup;
    const targetProductId = item.get('targetProductId')?.value;
    if (!targetProductId) return '';
    const product = this.targetProducts.find(p => p.id === targetProductId);
    return product?.unite || '';
  }

  onSubmit(): void {
    if (this.transferForm.valid && this.transferItems.length > 0) {
      const transferItems: TransferItem[] = this.transferItems.controls.map(control => {
        const formValue = control.getRawValue();
        return {
          targetProductId: formValue.targetProductId,
          quantity: parseFloat(formValue.quantity.toString()),
          conversionRatio: parseFloat(formValue.conversionRatio.toString())
        };
      });

      this.transferred.emit(transferItems);
    } else {
      this.error = 'Veuillez ajouter au moins un produit cible et remplir tous les champs';
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}

