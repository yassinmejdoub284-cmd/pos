import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { Product, ProductFamily } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-transfer-form',
  templateUrl: './product-transfer-form.component.html',
  standalone: false
})
export class ProductTransferFormComponent implements OnInit, OnChanges {
  @Input() sourceProduct: Product | null = null;
  @Output() transferred = new EventEmitter<{
    targetProductId: number;
    quantity: number;
    conversionRatio: number;
    targetType: string;
  }>();
  @Output() cancelled = new EventEmitter<void>();

  transferForm: FormGroup;
  targetProducts: Product[] = [];
  allProducts: Product[] = [];
  families: ProductFamily[] = [];
  loading = false;
  error = '';
  targetType: 'vrac' | 'stock' | 'gros' | 'imported' | 'family' = 'vrac';
  selectedFamilyId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService
  ) {
    this.transferForm = this.fb.group({
      targetType: ['vrac', Validators.required],
      targetFamilyId: [null],
      targetProductId: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.001)]],
      conversionRatio: [1, [Validators.required, Validators.min(0.001)]]
    });
  }

  ngOnInit(): void {
    // Initialize conversion ratio from source product if available
    if (this.sourceProduct?.conversionRatio) {
      this.transferForm.patchValue({ conversionRatio: this.sourceProduct.conversionRatio });
      // Disable the conversion ratio field when pre-filled from product
      this.transferForm.get('conversionRatio')?.disable();
    }
    
    this.loadFamilies();
    this.loadTargetProducts();
    this.transferForm.get('targetType')?.valueChanges.subscribe(type => {
      this.targetType = type;
      this.transferForm.patchValue({ targetProductId: null, targetFamilyId: null });
      this.selectedFamilyId = null;
      
      // Update validators based on target type
      const familyControl = this.transferForm.get('targetFamilyId');
      if (type === 'family') {
        familyControl?.setValidators([Validators.required]);
      } else {
        familyControl?.clearValidators();
      }
      familyControl?.updateValueAndValidity();
      
      this.loadTargetProducts();
    });
    this.transferForm.get('targetFamilyId')?.valueChanges.subscribe(familyId => {
      this.selectedFamilyId = familyId ? parseInt(familyId) : null;
      this.transferForm.patchValue({ targetProductId: null });
      this.loadTargetProducts();
    });
  }

  loadFamilies(): void {
    this.productsService.getFamilles().subscribe({
      next: (families) => {
        this.families = families;
      },
      error: (error) => {
        console.error('Error loading families:', error);
      }
    });
  }

  loadTargetProducts(): void {
    this.loading = true;
    this.error = '';
    
    const userDepotId = parseInt(sessionStorage.getItem('visitingDepotId') || sessionStorage.getItem('depotId') || '0');
    
    this.productsService.getProducts(userDepotId || undefined).subscribe({
      next: (products) => {
        this.allProducts = products;
        // Filter products based on target type
        let filtered = products.filter(product => {
          if (product.id === this.sourceProduct?.id) return false; // Exclude source product
          
          switch (this.targetType) {
            case 'vrac':
              return product.isVrac === true;
            case 'stock':
              return product.isStockable === true && !product.isVrac;
            case 'gros':
              return product.isWholesale === true;
            case 'imported':
              return product.name?.toLowerCase().includes('import');
            case 'family':
              // Filter by selected family
              if (this.selectedFamilyId) {
                return product.familleId === this.selectedFamilyId;
              }
              return true; // Show all if no family selected
            default:
              return false;
          }
        });

        // Family filter is already applied in the switch case above

        this.targetProducts = filtered;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    // Validate form
    if (this.transferForm.get('targetType')?.value === 'family' && !this.transferForm.get('targetFamilyId')?.value) {
      this.error = 'Veuillez sélectionner une famille';
      return;
    }
    
    if (this.transferForm.valid) {
      // Get form value including disabled controls
      const formValue = this.transferForm.getRawValue();
      this.transferred.emit({
        targetProductId: formValue.targetProductId,
        quantity: formValue.quantity,
        conversionRatio: formValue.conversionRatio,
        targetType: formValue.targetType
      });
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  getTargetQuantity(): number {
    const quantity = this.transferForm.get('quantity')?.value || 0;
    const ratio = this.transferForm.get('conversionRatio')?.value || 1;
    return quantity * ratio;
  }

  getTargetProductUnite(): string {
    const targetProductId = this.transferForm.get('targetProductId')?.value;
    if (!targetProductId) return '';
    const product = this.targetProducts.find(p => p.id === targetProductId);
    return product?.unite || '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sourceProduct'] && this.sourceProduct?.conversionRatio) {
      this.transferForm.patchValue({ conversionRatio: this.sourceProduct.conversionRatio });
      // Disable the conversion ratio field when pre-filled from product
      this.transferForm.get('conversionRatio')?.disable();
    } else if (changes['sourceProduct'] && !this.sourceProduct?.conversionRatio) {
      // Enable the field if product doesn't have conversion ratio
      this.transferForm.get('conversionRatio')?.enable();
    }
  }
}

