import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-vrac-conversion-form',
  templateUrl: './vrac-conversion-form.component.html',
  standalone: false
})
export class VracConversionFormComponent implements OnInit {
  @Input() product: Product | null = null;
  @Output() converted = new EventEmitter<{ 
    isStockable: boolean; 
    price: number; 
    conversionRatio: number;
    prix_vente_vrac: number;
    prix_achat_vrac: number;
  }>();
  @Output() cancelled = new EventEmitter<void>();

  isStockable = true;
  price = 0;
  conversionRatio = 1;
  prix_vente_vrac = 0;
  prix_achat_vrac = 0;

  ngOnInit(): void {
    if (this.product) {
      this.price = this.product.prix_vente_TTC;
      this.conversionRatio = this.product.conversionRatio || 1;
      this.prix_vente_vrac = this.product.prix_vente_vrac || 0;
      this.prix_achat_vrac = this.product.prix_achat_vrac || 0;
    }
  }

  onSubmit(): void {
    if (this.price <= 0) {
      return;
    }
    if (this.conversionRatio <= 0) {
      return;
    }

    this.converted.emit({
      isStockable: this.isStockable,
      price: this.price,
      conversionRatio: this.conversionRatio,
      prix_vente_vrac: this.prix_vente_vrac || 0,
      prix_achat_vrac: this.prix_achat_vrac || 0
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  getTargetQuantity(): number {
    return 1 * this.conversionRatio;
  }
}
