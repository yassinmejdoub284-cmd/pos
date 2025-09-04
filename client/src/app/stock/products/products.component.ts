import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../../core/services/products.service';
import { Product, ProductFamily } from '../../core/models/product.model';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
  standalone: false
})
export class ProductsComponent implements OnInit {
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  displayedProducts: Product[] = [];
  loading = false;
  error = '';
  currentPage = 1;
  itemsPerPage = 20;
  totalPages = 1;
  searchQuery = '';
  selectedFamille = 0;
  showAddModal = false;
  showImportModal = false;
  showImageUploadModal = false;
  showVragueModal = false;
  editingProduct: Product | null = null;
  selectedProductForImage: Product | null = null;
  selectedProductForVrague: Product | null = null;
  families: ProductFamily[] = [];

  constructor(private productsService: ProductsService) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadFamilies();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = '';

    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.allProducts = products;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loading = false;
      }
    });
  }

  loadFamilies(): void {
    this.productsService.getFamilles().subscribe({
      next: (families) => {
        this.families = families;
      },
      error: (error) => {
        console.error('Error loading families:', error);
      }
    });
  }

  applyFilters(): void {
    this.filteredProducts = this.allProducts.filter(product => {
      const matchesSearch = !this.searchQuery || 
        product.barcode?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        product.name?.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesFamille = !this.selectedFamille || product.familleId === this.selectedFamille;
      
      return matchesSearch && matchesFamille;
    });

    this.totalPages = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    this.updateDisplayedProducts();
  }

  updateDisplayedProducts(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedProducts = this.filteredProducts.slice(startIndex, endIndex);
  }

  onSearch(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onFilter(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updateDisplayedProducts();
  }

  openAddModal(): void {
    this.editingProduct = null;
    this.showAddModal = true;
  }

  openEditModal(product: Product): void {
    this.editingProduct = { ...product };
    this.showAddModal = true;
  }

  openImportModal(): void {
    this.showImportModal = true;
  }

  closeModal(): void {
    this.showAddModal = false;
    this.showImportModal = false;
    this.showVragueModal = false;
    this.editingProduct = null;
    this.selectedProductForVrague = null;
  }

  onProductSaved(): void {
    this.closeModal();
    this.loadProducts();
  }

  onImportCompleted(): void {
    this.closeModal();
    this.loadProducts();
  }



  deleteProduct(product: Product): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le produit "${product.name}" ?`)) {
      this.productsService.deleteProduct(product.id).subscribe({
        next: () => {
          this.loadProducts();
        },
        error: (error) => {
          this.error = 'Erreur lors de la suppression du produit';
        }
      });
    }
  }

  duplicateProduct(product: Product): void {
    const duplicatedProduct = {
      name: `${product.name} (Copie)`,
      description: product.description,
      famille: product.famille,
      barcode: '',
      unite: product.unite,
      prix_vente_TTC: product.prix_vente_TTC,
      tva: product.tva,
      photo: product.photo,
      duree_conservation: product.duree_conservation
    };

    this.editingProduct = duplicatedProduct as any;
    this.showAddModal = true;
  }

  exportProducts(): void {
    this.productsService.exportCsv().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'produits.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        this.error = 'Erreur lors de l\'export';
      }
    });
  }

  openImageUploadModal(product: Product): void {
    this.selectedProductForImage = product;
    this.showImageUploadModal = true;
  }

  closeImageUploadModal(): void {
    this.showImageUploadModal = false;
    this.selectedProductForImage = null;
  }

  onImageUploadConfirmed(file: File): void {
    if (!this.selectedProductForImage) return;

    this.productsService.uploadImage(file).subscribe({
      next: (response) => {
        // Update the product with the new image URL
        this.productsService.updateProduct(this.selectedProductForImage!.id, {
          photo: response.imageUrl
        }).subscribe({
          next: () => {
            // Update the product in the local array
            const product = this.allProducts.find(p => p.id === this.selectedProductForImage!.id);
            if (product) {
              product.photo = response.imageUrl;
              this.applyFilters(); // Refresh the display
            }
            this.closeImageUploadModal();
          },
          error: (error) => {
            this.error = 'Erreur lors de la mise à jour du produit';
          }
        });
      },
      error: (error) => {
        this.error = 'Erreur lors de l\'upload de l\'image';
      }
    });
  }

  onWarningsUpdated(): void {
    // Refresh warnings if needed
  }

  openVragueModal(product: Product): void {
    this.selectedProductForVrague = product;
    this.showVragueModal = true;
  }

  closeVragueModal(): void {
    this.showVragueModal = false;
    this.selectedProductForVrague = null;
  }

  convertToVrague(vragueData: { isStockable: boolean; price: number }): void {
    if (!this.selectedProductForVrague) return;

    // Find the vrague family
    const vragueFamily = this.families.find(f => f.name === 'Vrague');
    if (!vragueFamily) {
      this.error = 'Famille Vrague non trouvée';
      return;
    }

    const vragueProduct = {
      name: `${this.selectedProductForVrague.name} (Vrague)`,
      description: `Version vrague de ${this.selectedProductForVrague.name}`,
      familleId: vragueFamily.id,
      barcode: '', // Will be generated or left empty
      unite: this.selectedProductForVrague.unite,
      prix_vente_TTC: vragueData.price,
      tva: this.selectedProductForVrague.tva,
      photo: this.selectedProductForVrague.photo,
      duree_conservation: this.selectedProductForVrague.duree_conservation,
      isVrague: true,
      originalProductId: this.selectedProductForVrague.id,
      isStockable: vragueData.isStockable
    };

    this.productsService.createProduct(vragueProduct).subscribe({
      next: () => {
        this.closeVragueModal();
        this.loadProducts();
      },
      error: (error) => {
        this.error = 'Erreur lors de la création du produit vrague';
      }
    });
  }
} 