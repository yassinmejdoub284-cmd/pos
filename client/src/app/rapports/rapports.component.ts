import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-rapports',
  templateUrl: './rapports.component.html',
  standalone: false
})
export class RapportsComponent {

  constructor(private router: Router) {}

  navigateToReport(reportType: string) {
    switch (reportType) {
      case 'sessions-history':
        this.router.navigate(['/rapports/sessions-history']);
        break;
      case 'daily-monthly':
        this.router.navigate(['/rapports/daily-monthly']);
        break;
      case 'sales-by-category':
        this.router.navigate(['/rapports/sales-by-category']);
        break;
      case 'credit-sales':
        this.router.navigate(['/rapports/credit-sales']);
        break;
      case 'finance':
        this.router.navigate(['/rapports/finance']);
        break;
      case 'expenses':
        this.router.navigate(['/rapports/expenses']);
        break;
      case 'dashboard':
        this.router.navigate(['/rapports/dashboard']);
        break;
      case 'inventory-sales-reconciliation':
        this.router.navigate(['/rapports/inventory-sales-reconciliation']);
        break;
      case 'etat-mvt-stock':
        this.router.navigate(['/rapports/etat-mvt-stock']);
        break;
    }
  }

  // Keep the old method for backward compatibility
  navigateToDailyExtract() {
    this.router.navigate(['/rapports/daily-extract']);
  }

  navigateToHome() {
    this.router.navigate(['/home']);
  }
} 