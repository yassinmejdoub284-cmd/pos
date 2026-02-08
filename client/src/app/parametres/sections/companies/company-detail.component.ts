
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CompaniesService, Company } from '../../../core/services/companies.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-company-detail',
  templateUrl: './company-detail.component.html',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule]
})
export class CompanyDetailComponent implements OnInit {
  company: Partial<Company> = {
    statut: 'ACTIF',
    tvaAssujetti: true,
    tauxTva: 19,
    capitalSocial: 0,
    formeJuridique: 'SUARL'
  };
  loading = false;
  saving = false;
  uploading = false;
  error = '';
  isNew = true;
  id: number | null = null;

  constructor(
    private companiesService: CompaniesService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'new') {
      this.isNew = false;
      this.id = Number(idParam);
      this.loadCompany(this.id);
    }
  }

  loadCompany(id: number): void {
    this.loading = true;
    this.companiesService.getById(id).subscribe({
      next: (data) => {
        this.company = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement de l\'entreprise';
        this.loading = false;
        console.error(err);
      }
    });
  }

  save(): void {
    if (!this.company.raisonSociale || !this.company.matriculeFiscal) {
      this.error = 'Raison sociale et Matricule fiscal sont requis';
      return;
    }

    this.saving = true;
    this.error = '';

    if (this.isNew) {
      this.companiesService.create(this.company).subscribe({
        next: (data) => {
          this.saving = false;
          this.router.navigate(['/parametres/entreprises', data.id]);
        },
        error: (err) => {
          this.saving = false;
          this.error = 'Erreur lors de la création de l\'entreprise';
          console.error(err);
        }
      });
      } else {
        if (this.id) {
          const updateData = { ...this.company };
          // Ensure ID is not sent in body if not needed, but typical REST APIs ignore it or expect it
          this.companiesService.update(this.id, updateData).subscribe({
            next: (data) => {
              this.company = data;
              this.saving = false;
              
              // Check if this is the current user's company and update local state/storage if so
              const currentUser = this.authService.currentUser();
              if (currentUser && currentUser.companyId === this.id) {
                // Update session storage
                const updatedUser = { ...currentUser, companyName: data.raisonSociale };
                sessionStorage.setItem('user', JSON.stringify(updatedUser));
                this.authService.currentUser.set(updatedUser);
                
                // Force a reload to reflect changes everywhere (header, home, etc)
                // Or better, we can assume the HomeComponent will pick it up if we navigate there, 
                // but since we stay on page, the header might not update immediately without a shared state trigger.
                // For now, let's just update the auth service state which HomeComponent watches? 
                // HomeComponent watches authService.currentUser() in a way, but let's see.
                // Actually HomeComponent loads company details on Init.
                
                // Let's simply reload the page to be sure everything is sync, 
                // or we can emit an event.
                window.location.reload();
                return;
              }
              
              alert('Entreprise mise à jour avec succès');
            },
            error: (err) => {
              this.saving = false;
              this.error = 'Erreur lors de la mise à jour';
              console.error(err);
            }
          });
        }
      }
  }

  onLogoSelected(event: any): void {
    const file = event.target.files[0];
    if (file && this.id) {
      this.uploading = true;
      this.companiesService.uploadLogo(this.id, file).subscribe({
        next: (res) => {
          this.company.logoUrl = res.logoUrl;
          this.uploading = false;
          
          const currentUser = this.authService.currentUser();
          if (currentUser && currentUser.companyId === this.id) {
             // For logo update, we should also reload or trigger update
             // The HomeComponent loads logo from backend on init, so reload works.
             window.location.reload();
          }
        },
        error: (err) => {
          this.uploading = false;
          this.error = 'Erreur lors de l\'upload du logo';
          console.error(err);
        }
      });
    }
  }

  deleteCompany(): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette entreprise ? Cela dissociera tous les dépôts liés.') && this.id) {
      this.companiesService.delete(this.id).subscribe({
        next: () => {
          this.router.navigate(['/parametres/entreprises']);
        },
        error: (err) => {
          this.error = 'Erreur lors de la suppression';
          console.error(err);
        }
      });
    }
  }
}
