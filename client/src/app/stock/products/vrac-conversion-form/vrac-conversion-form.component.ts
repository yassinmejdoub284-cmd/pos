import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { Product } from '../../../core/models/product.model';
import { ProductsService } from '../../../core/services/products.service';

interface VracConversion {
  vracProductId: number;
  vracProductName: string;
  conversionRatio: number;
  prix_vente_vrac: number;
  prix_achat_vrac: number;
  isStockable: boolean;
}

@Component({
  selector: 'app-vrac-conversion-form',
  templateUrl: './vrac-conversion-form.component.html',
  standalone: false
})
export class VracConversionFormComponent implements OnInit, OnChanges {
  @Input() product: Product | null = null;
  @Input() allProducts: Product[] = [];
  @Output() converted = new EventEmitter<VracConversion[]>();
  @Output() cancelled = new EventEmitter<void>();

  availableVracProducts: Product[] = [];
  selectedConversions: VracConversion[] = [];
  searchVracQuery = '';
  loading = false;

  constructor(private productsService: ProductsService) {}

  ngOnInit(): void {
    this.loadAvailableVracProducts();
    if (this.product) {
      this.loadExistingConversions();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allProducts'] && !changes['allProducts'].firstChange) {
      this.loadAvailableVracProducts();
    }
    if (changes['product'] && this.product) {
      this.loadExistingConversions();
    }
  }

  loadExistingConversions(): void {
    if (!this.product) return;

    this.loading = true;
    this.productsService.getVracConversions(this.product.id).subscribe({
      next: (response) => {
        this.selectedConversions = response.conversions.map(conv => ({
          vracProductId: conv.targetProductId,
          vracProductName: conv.targetProductName,
          conversionRatio: conv.conversionRatio,
          prix_vente_vrac: conv.prix_vente_vrac || 0,
          prix_achat_vrac: conv.prix_achat_vrac || 0,
          isStockable: conv.isStockable
        }));
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
      }
    });
  }

  loadAvailableVracProducts(): void {
    if (this.allProducts && this.allProducts.length > 0) {
      const vracProduct = this.allProducts.find(p => 
        p.famille?.name === 'Vrac' || p.famille?.name === 'VRAC' || p.isVrac
      );
      
      if (vracProduct && vracProduct.famille) {
        this.availableVracProducts = this.allProducts.filter(p => 
          p.familleId === vracProduct.famille!.id && 
          p.id !== this.product?.id
        );
      } else {
        this.availableVracProducts = this.allProducts.filter(p => 
          (p.isVrac || p.famille?.name?.toLowerCase() === 'vrac') &&
          p.id !== this.product?.id
        );
      }
    }
  }

  getFilteredVracProducts(): Product[] {
    if (!this.searchVracQuery) {
      return this.availableVracProducts;
    }
    return this.availableVracProducts.filter(p => 
      p.name.toLowerCase().includes(this.searchVracQuery.toLowerCase())
    );
  }

  isVracProductSelected(vracProductId: number): boolean {
    return this.selectedConversions.some(c => c.vracProductId === vracProductId);
  }

  toggleVracProduct(vracProduct: Product): void {
    const existingIndex = this.selectedConversions.findIndex(c => c.vracProductId === vracProduct.id);
    
    if (existingIndex >= 0) {
      this.selectedConversions.splice(existingIndex, 1);
    } else {
      this.selectedConversions.push({
        vracProductId: vracProduct.id,
        vracProductName: vracProduct.name,
        conversionRatio: 1,
        prix_vente_vrac: vracProduct.prix_vente_TTC || 0,
        prix_achat_vrac: vracProduct.prix_achat || 0,
        isStockable: vracProduct.isStockable ?? true
      });
    }
  }

  updateConversion(index: number, field: keyof VracConversion, value: any): void {
    if (this.selectedConversions[index]) {
      (this.selectedConversions[index] as any)[field] = value;
    }
  }

  removeConversion(index: number): void {
    this.selectedConversions.splice(index, 1);
  }

  getTargetQuantity(conversionRatio: number): number {
    return 1 * conversionRatio;
  }

  onSubmit(): void {
    if (this.selectedConversions.length === 0) {
      return;
    }

    const validConversions = this.selectedConversions.filter(c => 
      c.conversionRatio > 0 && c.vracProductId > 0
    );

    if (validConversions.length === 0) {
      return;
    }

    this.converted.emit(validConversions);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
