import { Component, OnInit } from '@angular/core';
import { FamiliesService } from '../../core/services/families.service';
import { ProductFamily } from '../../core/models/product-family.model';

@Component({
  selector: 'app-families',
  templateUrl: './families.component.html',
  styleUrls: ['./families.component.css'],
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

  onImageUploadConfirmed(file: File): void {
    if (!this.selectedFamilyForImage) return;

    this.familiesService.uploadFamilyPhoto(this.selectedFamilyForImage.id, file).subscribe({
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

  deleteFamily(family: ProductFamily): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la famille "${family.name}" ?`)) {
      this.familiesService.deleteFamily(family.id).subscribe({
        next: () => {
          this.loadFamilies();
        },
        error: (error) => {
          this.error = error.error?.error || 'Erreur lors de la suppression de la famille';
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
