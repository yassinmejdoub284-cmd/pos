import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';

@Component({
  selector: 'app-entry-options',
  templateUrl: './entry-options.component.html',
  standalone: false
})
export class EntryOptionsComponent implements OnInit {
  depotId!: number;
  depot: Depot | null = null;
  loading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.depotId = +this.route.snapshot.paramMap.get('depotId')!;
    this.loadDepot();
  }

  loadDepot(): void {
    this.loading = true;
    this.error = '';
    
    this.depotsService.get(this.depotId).subscribe({
      next: (depot) => {
        this.depot = depot;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du dépôt';
        this.loading = false;
        console.error('Error loading depot:', error);
      }
    });
  }

  selectNewEntry(): void {
    this.router.navigate(['/stock-management/new-entry', this.depotId]);
  }

  selectImportEntry(): void {
    this.router.navigate(['/stock-management/import-entry', this.depotId]);
  }

  selectReturn(): void {
    this.router.navigate(['/stock/documents/bon-retour', this.depotId]);
  }

  goBack(): void {
    this.router.navigate(['/stock-management/depot-selection']);
  }
}
