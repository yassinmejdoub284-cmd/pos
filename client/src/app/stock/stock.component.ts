import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DepotsService } from '../core/services/depots.service';
import { Depot } from '../core/models/depot.model';

@Component({
  selector: 'app-stock',
  templateUrl: './stock.component.html',
  standalone: false
})
export class StockComponent implements OnInit {
  depots: Depot[] = [];
  loading = false;
  error = '';

  constructor(private depotsService: DepotsService, private router: Router) {}

  ngOnInit(): void {
    this.loading = true;
    this.depotsService.list().subscribe({
      next: (depots) => {
        this.depots = depots.filter(d => d.isActive);
        this.loading = false;
      },
      error: () => {
        this.error = "Erreur lors du chargement des dépôts";
        this.loading = false;
      }
    });
  }

  openWorkspace(depot: Depot): void {
    const section = depot.type === 'SHOP' ? 'reception-magasin' : 'workspace';
    this.router.navigate(['/stock/site', depot.id, section]);
  }
} 