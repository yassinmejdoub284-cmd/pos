import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../../core/services/products.service';
import { Product, ProductFamily } from '../../core/models/product.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
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
  selectedType = 'all';
  showAddModal = false;
  showImportModal = false;
  showImageUploadModal = false;
  showVracModal = false;
  showTransferModal = false;
  editingProduct: Product | null = null;
  selectedProductForImage: Product | null = null;
  selectedProductForVrac: Product | null = null;
  selectedProductForTransfer: Product | null = null;
  families: ProductFamily[] = [];
  viewMode: 'table' | 'grid' = 'table';

  // Palette classes for family badges (light vibrant colors)
  private familyColorClasses: string[] = [
    'bg-gradient-to-r from-pink-100 to-rose-200 text-rose-800 border border-rose-200',
    'bg-gradient-to-r from-purple-100 to-violet-200 text-violet-800 border border-violet-200',
    'bg-gradient-to-r from-indigo-100 to-blue-200 text-indigo-800 border border-indigo-200',
    'bg-gradient-to-r from-emerald-100 to-green-200 text-emerald-800 border border-emerald-200',
    'bg-gradient-to-r from-amber-100 to-orange-200 text-amber-800 border border-amber-200',
    'bg-gradient-to-r from-cyan-100 to-sky-200 text-cyan-800 border border-cyan-200'
  ];

  constructor(private productsService: ProductsService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadFamilies();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = '';

    // Determine current depot like in caisse: visitingDepotId overrides user's depotId
    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    this.productsService.getProducts(currentDepotId || undefined).subscribe({
      next: (products) => {
        // Transform depotAssignments to assignedDepots for all products
        this.allProducts = products.map(product => {
          if (product.depotAssignments && product.depotAssignments.length > 0 && !product.assignedDepots) {
            product.assignedDepots = product.depotAssignments
              .map(assignment => assignment.depot)
              .filter((depot): depot is NonNullable<typeof depot> => depot !== null && depot !== undefined);
          }
          return product;
        });
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

  getFamilyClass(familyId?: number): string {
    if (!familyId || this.families.length === 0) {
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
    const index = this.families.findIndex(f => f.id === familyId);
    if (index === -1) {
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
    const paletteIndex = index % this.familyColorClasses.length;
    return this.familyColorClasses[paletteIndex];
  }

  applyFilters(): void {
    this.filteredProducts = this.allProducts.filter(product => {
      const matchesSearch = !this.searchQuery || 
        product.barcode?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        product.name?.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesFamille = !this.selectedFamille || product.familleId === this.selectedFamille;
      
      const matchesType = this.selectedType === 'all' || 
        (this.selectedType === 'vrac' && product.isVraguable) ||
        (this.selectedType === 'stock' && product.isStockable) ||
        (this.selectedType === 'wholesale' && product.isWholesale) ||
        (this.selectedType === 'imported' && product.name && product.name.toLowerCase().includes('import'));
      
      return matchesSearch && matchesFamille && matchesType;
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

  setFamilyFilter(familyId: number): void {
    this.selectedFamille = familyId;
    this.onFilter();
  }

  setTypeFilter(type: string): void {
    this.selectedType = type;
    this.onFilter();
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
    // Transform depotAssignments to assignedDepots if needed
    const editingProduct: Product = { ...product };
    if (product.depotAssignments && product.depotAssignments.length > 0 && !product.assignedDepots) {
      editingProduct.assignedDepots = product.depotAssignments
        .map(assignment => assignment.depot)
        .filter((depot): depot is NonNullable<typeof depot> => depot !== null && depot !== undefined);
    }
    this.editingProduct = editingProduct;
    this.showAddModal = true;
  }

  openImportModal(): void {
    this.showImportModal = true;
  }

  closeModal(): void {
    this.showAddModal = false;
    this.showImportModal = false;
    this.showVracModal = false;
    this.showTransferModal = false;
    this.editingProduct = null;
    this.selectedProductForVrac = null;
    this.selectedProductForTransfer = null;
  }

  openTransferModal(product: Product): void {
    this.selectedProductForTransfer = product;
    this.showTransferModal = true;
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
    this.selectedProductForTransfer = null;
  }

  onProductTransferred(transferData: {
    targetProductId: number;
    quantity: number;
    conversionRatio: number;
    targetType: string;
  }): void {
    if (!this.selectedProductForTransfer) return;

    this.loading = true;
    this.error = '';

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    const transferPayload = {
      sourceProductId: this.selectedProductForTransfer.id,
      targetProductId: transferData.targetProductId,
      quantity: parseFloat(transferData.quantity.toString()),
      conversionRatio: parseFloat(transferData.conversionRatio.toString()),
      depotId: currentDepotId
    };

    console.log('Transfer payload:', transferPayload);

    this.productsService.transferProduct(transferPayload).subscribe({
      next: () => {
        this.closeTransferModal();
        this.loadProducts();
        this.loading = false;
      },
      error: (error) => {
        this.error = error.error?.error || 'Erreur lors du transfert du produit';
        this.loading = false;
      }
    });
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

  onImageUploadConfirmed(data: File | string): void {
    if (!this.selectedProductForImage) return;

    // Store the product ID before starting upload to avoid null reference issues
    const productId = this.selectedProductForImage.id;

    if (typeof data === 'string') {
      // Handle URL upload
      this.productsService.updateProductPhotoUrl(productId, data).subscribe({
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
          this.error = 'Erreur lors de la mise à jour de l\'URL de l\'image';
        }
      });
    } else {
      // Handle file upload
      this.productsService.uploadProductPhoto(productId, data).subscribe({
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

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'table' ? 'grid' : 'table';
  }
} 