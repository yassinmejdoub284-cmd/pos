
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CompaniesService, Company } from '../../../core/services/companies.service';

@Component({
  selector: 'app-company-list',
  templateUrl: './company-list.component.html',
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class CompanyListComponent implements OnInit {
  companies: Company[] = [];
  loading = false;
  error = '';

  constructor(
    private companiesService: CompaniesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.loading = true;
    this.companiesService.getAll().subscribe({
      next: (data) => {
        this.companies = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des entreprises';
        this.loading = false;
        console.error(err);
      }
    });
  }

  navigateToAdd(): void {
    this.router.navigate(['/parametres/entreprises/new']);
  }

  navigateToEdit(id: number): void {
    this.router.navigate(['/parametres/entreprises', id]);
  }
}
