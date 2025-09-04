import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-vrague-conversion-form',
  templateUrl: './vrague-conversion-form.component.html',
  styleUrls: ['./vrague-conversion-form.component.css'],
  standalone: false
})
export class VragueConversionFormComponent {
  @Input() product: Product | null = null;
  @Output() converted = new EventEmitter<{ isStockable: boolean; price: number }>();
  @Output() cancelled = new EventEmitter<void>();

  isStockable = true;
  price = 0;

  ngOnInit(): void {
    if (this.product) {
      this.price = this.product.prix_vente_TTC;
    }
  }

  onSubmit(): void {
    if (this.price <= 0) {
      return;
    }

    this.converted.emit({
      isStockable: this.isStockable,
      price: this.price
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
