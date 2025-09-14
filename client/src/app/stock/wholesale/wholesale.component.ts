import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../../core/services/products.service';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-wholesale',
  templateUrl: './wholesale.component.html',
  standalone: false
})
export class WholesaleComponent implements OnInit {
  wholesaleProducts: Product[] = [];
  loading = false;
  error = '';

  constructor(private productsService: ProductsService) {}

  ngOnInit(): void {
    this.loadWholesaleProducts();
  }

  loadWholesaleProducts(): void {
    this.loading = true;
    this.error = '';
    
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.wholesaleProducts = products.filter(product => product.isWholesale);
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits de gros';
        this.loading = false;
        console.error('Error loading wholesale products:', error);
      }
    });
  }

  getBundleUnitPrice(bundlePrice: number, bundleSize: number): number {
    return bundlePrice / bundleSize;
  }

  getMarginInfo(product: Product): { unitPrice: number; bundlePrice: number; margin: number } {
    const unitPrice = product.prix_vente_TTC;
    const bundlePrice = product.bundlePrice || 0;
    const bundleSize = product.bundleSize || 1;
    const bundleUnitPrice = bundlePrice / bundleSize;
    const margin = ((bundleUnitPrice - unitPrice) / unitPrice) * 100;
    
    return {
      unitPrice,
      bundlePrice,
      margin
    };
  }

  formatMargin(margin: number): string {
    const sign = margin >= 0 ? '+' : '';
    return `${sign}${margin.toFixed(1)}%`;
  }

  getMarginClass(margin: number): string {
    if (margin > 0) {
      return 'text-green-600 bg-green-100';
    } else if (margin < 0) {
      return 'text-red-600 bg-red-100';
    } else {
      return 'text-gray-600 bg-gray-100';
    }
  }

  getAverageMargin(): string {
    if (this.wholesaleProducts.length === 0) return '0.0';
    
    const totalMargin = this.wholesaleProducts.reduce((sum, product) => {
      const marginInfo = this.getMarginInfo(product);
      return sum + marginInfo.margin;
    }, 0);
    
    return (totalMargin / this.wholesaleProducts.length).toFixed(1);
  }

  getApprovalRequiredCount(): number {
    return 0; // Approval system removed
  }
}
