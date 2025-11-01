import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-stock-management',
  templateUrl: './stock-management.component.html',
  standalone: false
})
export class StockManagementComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit(): void {}

  navigateToDepotSelection(): void {
    this.router.navigate(['/stock-management/depot-selection']);
  }

  navigateToReturnDepotSelection(): void {
    this.router.navigate(['/stock/documents/bon-retour/4']); // Navigate directly to depot 4 for now
  }
}
