import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';

@Component({
  selector: 'app-site',
  templateUrl: './site.component.html',
  styleUrls: ['./site.component.css'],
  standalone: false
})
export class SiteComponent implements OnInit {
  depotId!: number;
  section: 'workspace' | 'preparer-lot' | 'reception-depot' | 'transfert-vers-branche' | 'transfert-vers-magasin' | 'reception-magasin' = 'workspace';
  depot?: Depot;
  loading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const sectionParam = params.get('section');
      this.depotId = idParam ? parseInt(idParam, 10) : 0;
      this.section = (sectionParam as any) || 'workspace';
      this.fetchDepot();
    });
  }

  fetchDepot(): void {
    if (!this.depotId) return;
    this.loading = true;
    this.depotsService.get(this.depotId).subscribe({
      next: (depot) => { this.depot = depot; this.loading = false; },
      error: () => { this.error = 'Dépôt introuvable'; this.loading = false; }
    });
  }

  go(section: string): void {
    this.router.navigate(['/stock/site', this.depotId, section]);
  }
} 