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
  showVracModal = false;
  editingProduct: Product | null = null;
  selectedProductForImage: Product | null = null;
  selectedProductForVrac: Product | null = null;
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
    this.showVracModal = false;
    this.editingProduct = null;
    this.selectedProductForVrac = null;
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

    // Store the product ID before starting upload to avoid null reference issues
    const productId = this.selectedProductForImage.id;

    this.productsService.uploadProductPhoto(productId, file).subscribe({
      next: (response) => {
        // Update the product in the local array
        const product = this.allProducts.find(p => p.id === productId);
        if (product) {
          product.photo = response.imageUrl;
          this.applyFilters(); // Refresh the display
        }
        this.closeImageUploadModal();
      },
      error: (error) => {
        this.error = 'Erreur lors de l\'upload de l\'image';
      }
    });
  }

  onWarningsUpdated(): void {
    // Refresh warnings if needed
  }

  openVracModal(product: Product): void {
    this.selectedProductForVrac = product;
    this.showVracModal = true;
  }

  closeVracModal(): void {
    this.showVracModal = false;
    this.selectedProductForVrac = null;
  }

  convertToVrac(vracData: { isStockable: boolean; price: number }): void {
    if (!this.selectedProductForVrac) return;

    // Find the vrac family
    const vracFamily = this.families.find(f => f.name === 'Vrac');
    if (!vracFamily) {
      this.error = 'Famille Vrac non trouvée';
      return;
    }

    const vracProduct = {
      name: `${this.selectedProductForVrac.name} (Vrac)`,
      description: `Version vrac de ${this.selectedProductForVrac.name}`,
      familleId: vracFamily.id,
      barcode: '', // Will be generated or left empty
      unite: this.selectedProductForVrac.unite,
      prix_vente_TTC: vracData.price,
      tva: this.selectedProductForVrac.tva,
      photo: this.selectedProductForVrac.photo,
      duree_conservation: this.selectedProductForVrac.duree_conservation,
      isVrac: true,
      originalProductId: this.selectedProductForVrac.id,
      isStockable: vracData.isStockable
    };

    this.productsService.createProduct(vracProduct).subscribe({
      next: () => {
        this.closeVracModal();
        this.loadProducts();
      },
      error: (error) => {
        this.error = 'Erreur lors de la création du produit vrac';
      }
    });
  }

  getVracConvertibleCount(): number {
    return this.displayedProducts.filter(product => product.isVraguable === true).length;
  }

  getStockableCount(): number {
    return this.displayedProducts.filter(product => product.isStockable === true).length;
  }

  getVracProductsCount(): number {
    return this.displayedProducts.filter(product => product.isVrac === true).length;
  }
} 