import { Component } from '@angular/core';

@Component({
  selector: 'app-shop-transfer-simple',
  template: `
    <div class="p-4">
      <h1>Shop Transfer - Simple Test</h1>
      <p>This is a simple test component to verify routing works.</p>
      <button (click)="goBack()" class="px-4 py-2 bg-blue-500 text-white rounded">
        Go Back
      </button>
    </div>
  `,
  standalone: false
})
export class ShopTransferSimpleComponent {
  goBack() {
    window.history.back();
  }
}
