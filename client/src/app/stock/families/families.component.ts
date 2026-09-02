import { Component, OnInit } from '@angular/core';
import { FamiliesService } from '../../core/services/families.service';
import { ProductFamily } from '../../core/models/product-family.model';

@Component({
  selector: 'app-families',
  templateUrl: './families.component.html',
  standalone: false
})
export class FamiliesComponent implements OnInit {
  families: ProductFamily[] = [];
  loading = false;
  error = '';
  showAddModal = false;
  showEditModal = false;
  showImageUploadModal = false;
  editingFamily: ProductFamily | null = null;
  selectedFamilyForImage: ProductFamily | null = null;

  constructor(private familiesService: FamiliesService) {}

  ngOnInit(): void {
    this.loadFamilies();
  }

  loadFamilies(): void {
    this.loading = true;
    this.error = '';

    this.familiesService.getFamilies().subscribe({
      next: (families) => {
        this.families = families;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des familles';
        this.loading = false;
      }
    });
  }

  openAddModal(): void {
    this.editingFamily = null;
    this.showAddModal = true;
  }

  openEditModal(family: ProductFamily): void {
    this.editingFamily = family;
    this.showEditModal = true;
  }

  openImageUploadModal(family: ProductFamily): void {
    this.selectedFamilyForImage = family;
    this.showImageUploadModal = true;
  }

  closeModals(): void {
    this.showAddModal = false;
    this.showEditModal = false;
    this.showImageUploadModal = false;
    this.editingFamily = null;
    this.selectedFamilyForImage = null;
  }

  onFamilySaved(): void {
    this.closeModals();
    this.loadFamilies();
  }

  onImageUploadConfirmed(data: File | string): void {
    if (!this.selectedFamilyForImage) return;

    if (typeof data === 'string') {
      // Handle URL upload
      this.familiesService.updateFamilyPhotoUrl(this.selectedFamilyForImage.id, data).subscribe({
        next: (response) => {
          const family = this.families.find(f => f.id === this.selectedFamilyForImage!.id);
          if (family) {
            family.photo = response.imageUrl;
          }
          this.closeImageUploadModal();
        },
        error: (error) => {
          this.error = 'Erreur lors de la mise à jour de l\'URL de l\'image';
        }
      });
    } else {
      // Handle file upload
      this.familiesService.uploadFamilyPhoto(this.selectedFamilyForImage.id, data).subscribe({
        next: (response) => {
          const family = this.families.find(f => f.id === this.selectedFamilyForImage!.id);
          if (family) {
            family.photo = response.imageUrl;
          }
          this.closeImageUploadModal();
        },
        error: (error) => {
          this.error = 'Erreur lors de l\'upload de l\'image';
        }
      });
    }
  }

  deleteFamily(family: ProductFamily): void {
    const productCount = Number((family as any)._count?.products || 0);

    // Une famille qui contient encore des produits peut etre supprimee :
    // les produits ne sont pas effaces, ils se retrouvent simplement sans
    // famille et restent modifiables depuis la fiche produit.
    let moveTo: number | null = null;
    if (productCount > 0) {
      const others = (this.families || []).filter(f => f.id !== family.id);
      if (others.length === 0) {
        this.error = `Impossible: "${family.name}" contient ${productCount} produit(s) et c'est la seule famille. Creez d'abord une autre famille.`;
        return;
      }
      const liste = others.map(f => `${f.id} - ${f.name}`).join('\n');
      const saisie = prompt(
        `La famille "${family.name}" contient ${productCount} produit(s).\n` +
        `Ils seront DEPLACES (jamais supprimes) vers une autre famille.\n\n` +
        `Saisissez le numero de la famille de destination :\n\n${liste}`
      );
      if (!saisie) return;
      const cible = Number(saisie.trim());
      if (!others.some(f => f.id === cible)) {
        this.error = 'Numero de famille invalide.';
        return;
      }
      moveTo = cible;
    } else if (!confirm(`Etes-vous sur de vouloir supprimer la famille "${family.name}" ?`)) {
      return;
    }

    {
      this.familiesService.deleteFamily(family.id, moveTo).subscribe({
        next: () => {
          this.loadFamilies();
        },
        error: (error) => {
          // Graceful error for server-side constraint
          if (error?.status === 409) {
            this.error = 'Suppression impossible: cette famille est liée à des produits.';
          } else {
            this.error = error?.error?.error || 'Erreur lors de la suppression de la famille';
          }
        }
      });
    }
  }

  deleteFamilyPhoto(family: ProductFamily): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer la photo de cette famille ?')) {
      this.familiesService.deleteFamilyPhoto(family.id).subscribe({
        next: (response) => {
          family.photo = undefined;
        },
        error: (error) => {
          this.error = 'Erreur lors de la suppression de la photo';
        }
      });
    }
  }

  closeImageUploadModal(): void {
    this.selectedFamilyForImage = null;
    this.showImageUploadModal = false;
  }
}
