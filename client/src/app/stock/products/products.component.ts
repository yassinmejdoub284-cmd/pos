import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../../core/services/products.service';
import { Product, ProductFamily, Depot as ProductDepot } from '../../core/models/product.model';
import { AuthService } from '../../core/services/auth.service';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';
import { forkJoin, firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

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
  showAddToDepotModal = false;
  editingProduct: Product | null = null;
  selectedProductForImage: Product | null = null;
  selectedProductForVrac: Product | null = null;
  selectedProductForTransfer: Product | null = null;
  selectedProductForDepot: Product | null = null;
  selectedDepotForAssignment: number | null = null;
  selectedSourceDepots: number[] = [];
  similarProducts: Product[] = [];
  selectedSourceProduct: Product | null = null;
  loadingSimilarProducts = false;
  searchProductName = '';
  families: ProductFamily[] = [];
  viewMode: 'table' | 'grid' = 'table';
  depots: Depot[] = [];
  selectedDepotId: number | null = null;
  productVracConversionsCount: Map<number, number> = new Map();

  // Palette classes for family badges (light vibrant colors)
  private familyColorClasses: string[] = [
    'bg-gradient-to-r from-pink-100 to-rose-200 text-rose-800 border border-rose-200',
    'bg-gradient-to-r from-purple-100 to-violet-200 text-violet-800 border border-violet-200',
    'bg-gradient-to-r from-indigo-100 to-blue-200 text-indigo-800 border border-indigo-200',
    'bg-gradient-to-r from-emerald-100 to-green-200 text-emerald-800 border border-emerald-200',
    'bg-gradient-to-r from-amber-100 to-orange-200 text-amber-800 border border-amber-200',
    'bg-gradient-to-r from-cyan-100 to-sky-200 text-cyan-800 border border-cyan-200'
  ];

  constructor(
    private productsService: ProductsService,
    private authService: AuthService,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.loadDepots();
    this.loadFamilies();
  }

  loadDepots(): void {
    const isAdmin = this.authService.isAdmin();
    const currentUser = this.authService.currentUser();
    
    if (isAdmin) {
      // Admin can see and select all depots
      this.depotsService.list().subscribe({
        next: (depots) => {
          this.depots = depots.filter(d => d.isActive);
          // Initialize selected depot from session or user's depot
          const userDepotId = currentUser?.depotId || 0;
          const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
          const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;
          this.selectedDepotId = currentDepotId || null;
          this.loadProducts();
        },
        error: (error) => {
          console.error('Error loading depots:', error);
          this.error = 'Erreur lors du chargement des dépôts';
          this.loading = false;
        }
      });
    } else {
      // Non-admin users can only see their assigned depot
      const userDepotId = currentUser?.depotId;
      if (userDepotId) {
        this.depotsService.get(userDepotId).subscribe({
          next: (depot) => {
            this.depots = [depot];
            this.selectedDepotId = userDepotId;
            this.loadProducts();
          },
          error: (error) => {
            console.error('Error loading user depot:', error);
            this.error = 'Erreur lors du chargement de votre dépôt';
            this.loading = false;
          }
        });
      } else {
        this.error = 'Aucun dépôt assigné à votre compte';
        this.loading = false;
      }
    }
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  onDepotChange(): void {
    this.currentPage = 1;
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = '';

    if (this.selectedDepotId === null) {
      // Load products from all depots
      const activeDepots = this.depots.filter(d => d.isActive);
      if (activeDepots.length === 0) {
        this.error = 'Aucun dépôt actif trouvé';
        this.loading = false;
        return;
      }

      const productRequests = activeDepots.map(depot =>
        this.productsService.getProducts(depot.id)
      );

      forkJoin(productRequests).subscribe({
        next: (productsArrays) => {
          // Combine all products and remove duplicates by product ID
          const productMap = new Map<number, Product>();
          
          productsArrays.forEach(products => {
            products.forEach(product => {
              if (!productMap.has(product.id)) {
                // Transform depotAssignments to assignedDepots
                if (product.depotAssignments && product.depotAssignments.length > 0 && !product.assignedDepots) {
                  product.assignedDepots = product.depotAssignments
                    .map(assignment => assignment.depot)
                    .filter((depot): depot is NonNullable<typeof depot> => depot !== null && depot !== undefined);
                }
                productMap.set(product.id, product);
              } else {
                // Merge depot assignments if product already exists
                const existingProduct = productMap.get(product.id)!;
                if (product.depotAssignments && product.depotAssignments.length > 0) {
                  const newDepots = product.depotAssignments
                    .map(assignment => assignment.depot)
                    .filter((depot): depot is NonNullable<typeof depot> => depot !== null && depot !== undefined);
                  
                  if (existingProduct.assignedDepots) {
                    const existingDepotIds = existingProduct.assignedDepots.map(d => d.id);
                    newDepots.forEach(depot => {
                      if (!existingDepotIds.includes(depot.id)) {
                        existingProduct.assignedDepots!.push(depot);
                      }
                    });
                  } else {
                    existingProduct.assignedDepots = newDepots;
                  }
                }
              }
            });
          });

          this.allProducts = Array.from(productMap.values());
          this.loadVracConversionsCount();
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Erreur lors du chargement des produits';
          this.loading = false;
        }
      });
    } else {
      // Load products from selected depot
      this.productsService.getProducts(this.selectedDepotId).subscribe({
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
          this.loadVracConversionsCount();
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Erreur lors du chargement des produits';
          this.loading = false;
        }
      });
    }
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
    this.showAddToDepotModal = false;
    this.editingProduct = null;
    this.selectedProductForVrac = null;
    this.selectedProductForTransfer = null;
    this.selectedProductForDepot = null;
    this.selectedDepotForAssignment = null;
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

  loadVracConversionsCount(): void {
    this.productVracConversionsCount.clear();
    const productIds = this.allProducts.map(p => p.id);
    
    if (productIds.length === 0) return;
    
    const conversionRequests = productIds.map(productId => 
      this.productsService.getVracConversions(productId).pipe(
        catchError(() => {
          return of({ sourceProductId: productId, conversions: [] });
        })
      )
    );
    
    forkJoin(conversionRequests).subscribe({
      next: (responses) => {
        responses.forEach(response => {
          if (response && response.conversions) {
            this.productVracConversionsCount.set(response.sourceProductId, response.conversions.length);
            if (response.conversions.length > 0 && !this.allProducts.find(p => p.id === response.sourceProductId)?.isVraguable) {
              const product = this.allProducts.find(p => p.id === response.sourceProductId);
              if (product) {
                product.isVraguable = true;
              }
            }
          }
        });
      }
    });
  }

  getVracConversionsCount(productId: number): number {
    return this.productVracConversionsCount.get(productId) || 0;
  }

  hasVracConversions(productId: number): boolean {
    return this.getVracConversionsCount(productId) > 0;
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

  convertToVrac(conversions: Array<{
    vracProductId: number;
    vracProductName: string;
    conversionRatio: number;
    prix_vente_vrac: number;
    prix_achat_vrac: number;
    isStockable: boolean;
  }>): void {
    if (!this.selectedProductForVrac || conversions.length === 0) return;

    this.loading = true;
    this.error = '';

    const conversionsPayload = conversions.map(conversion => ({
      targetProductId: conversion.vracProductId,
      conversionRatio: conversion.conversionRatio,
      prix_vente_vrac: conversion.prix_vente_vrac || undefined,
      prix_achat_vrac: conversion.prix_achat_vrac || undefined,
      isStockable: conversion.isStockable
    }));

    this.productsService.createVracConversions(
      this.selectedProductForVrac.id,
      conversionsPayload
    ).subscribe({
      next: () => {
        this.closeVracModal();
        this.loadProducts();
        this.loading = false;
      },
      error: (error) => {
        this.error = error.error?.error || 'Erreur lors de la création des conversions VRAC';
        this.loading = false;
      }
    });
  }

  getVracConvertibleCount(): number {
    return this.displayedProducts.filter(product => 
      product.isVraguable === true || this.hasVracConversions(product.id)
    ).length;
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

  openAddToDepotModal(product: Product): void {
    this.selectedProductForDepot = product;
    this.selectedDepotForAssignment = null;
    this.selectedSourceDepots = [];
    this.similarProducts = [];
    this.selectedSourceProduct = null;
    this.searchProductName = '';
    this.showAddToDepotModal = true;
  }

  getAvailableDepots(): Depot[] {
    if (!this.selectedProductForDepot) {
      return this.depots;
    }
    const assignedDepotIds = this.selectedProductForDepot.assignedDepots?.map(d => d.id) || [];
    return this.depots.filter(depot => !assignedDepotIds.includes(depot.id));
  }

  getSelectedProductAssignedDepots(): ProductDepot[] {
    return this.selectedProductForDepot?.assignedDepots || [];
  }

  closeAddToDepotModal(): void {
    this.showAddToDepotModal = false;
    this.selectedProductForDepot = null;
    this.selectedDepotForAssignment = null;
    this.selectedSourceDepots = [];
    this.similarProducts = [];
    this.selectedSourceProduct = null;
    this.searchProductName = '';
  }

  toggleSourceDepot(depotId: number): void {
    if (this.selectedSourceDepots.includes(depotId)) {
      this.selectedSourceDepots = this.selectedSourceDepots.filter(id => id !== depotId);
    } else {
      this.selectedSourceDepots.push(depotId);
    }
    this.selectedSourceProduct = null;
    this.loadSimilarProducts();
  }

  onSourceDepotsChange(): void {
    this.selectedSourceProduct = null;
    this.loadSimilarProducts();
  }

  loadSimilarProducts(): void {
    if (this.selectedSourceDepots.length === 0) {
      this.similarProducts = [];
      return;
    }

    this.loadingSimilarProducts = true;
    
    // If search term is provided, use it, otherwise get all products
    const searchParams: any = {
      sourceDepotIds: this.selectedSourceDepots,
      destinationProductId: this.selectedProductForDepot?.id
    };
    
    if (this.searchProductName && this.searchProductName.trim()) {
      searchParams.productName = this.searchProductName.trim();
    }
    
    this.productsService.getSimilarProducts(searchParams).subscribe({
      next: (products) => {
        this.similarProducts = products;
        this.loadingSimilarProducts = false;
      },
      error: (error) => {
        console.error('Error loading similar products:', error);
        this.error = 'Erreur lors du chargement des produits similaires';
        this.loadingSimilarProducts = false;
      }
    });
  }

  onSearchProductNameChange(): void {
    // Load products when search changes
    this.loadSimilarProducts();
  }

  addProductToDepot(): void {
    if (!this.selectedProductForDepot) {
      this.error = 'Aucun produit sélectionné';
      return;
    }

    // If source product is selected, create a link instead of just assigning depot
    if (this.selectedSourceProduct && this.selectedSourceDepots.length > 0) {
      this.createProductDepotLink();
      return;
    }

    // Otherwise, just assign product to depot (original behavior)
    if (!this.selectedDepotForAssignment) {
      this.error = 'Veuillez sélectionner un dépôt';
      return;
    }

    // Get current depot assignments
    const currentDepotIds = this.selectedProductForDepot.assignedDepots?.map(d => d.id) || [];
    
    // Check if product is already assigned to this depot
    if (currentDepotIds.includes(this.selectedDepotForAssignment)) {
      this.error = 'Ce produit est déjà assigné à ce dépôt';
      return;
    }

    this.loading = true;
    this.error = '';

    // Add the new depot to the list
    const updatedDepotIds = [...currentDepotIds, this.selectedDepotForAssignment];

    // Update the product with new depot assignments
    // Only send depotIds to update depot assignments
    const updateData: any = {
      depotIds: updatedDepotIds
    };

    this.productsService.updateProduct(this.selectedProductForDepot.id, updateData).subscribe({
      next: () => {
        this.closeAddToDepotModal();
        this.loadProducts();
        this.loading = false;
      },
      error: (error) => {
        this.error = error.error?.error || 'Erreur lors de l\'ajout du produit au dépôt';
        this.loading = false;
      }
    });
  }

  createProductDepotLink(): void {
    if (!this.selectedProductForDepot || !this.selectedSourceProduct || this.selectedSourceDepots.length === 0) {
      this.error = 'Veuillez sélectionner un produit source et un dépôt source';
      return;
    }

    // Get destination depot - use selectedDepotForAssignment or first assigned depot
    const destinationDepotId = this.selectedDepotForAssignment || 
      (this.selectedProductForDepot.assignedDepots && this.selectedProductForDepot.assignedDepots.length > 0 
        ? this.selectedProductForDepot.assignedDepots[0].id 
        : null);

    if (!destinationDepotId) {
      this.error = 'Le produit destination doit être assigné à un dépôt';
      return;
    }

    // For each source depot, create a link
    this.loading = true;
    this.error = '';

    if (!this.selectedSourceProduct || !this.selectedProductForDepot) {
      this.error = 'Produits non sélectionnés';
      this.loading = false;
      return;
    }

    const linkPromises = this.selectedSourceDepots.map(async (sourceDepotId) => {
      // Find which depot the source product is assigned to
      const sourceProductDepots = this.selectedSourceProduct!.assignedDepots?.map(d => d.id) || [];
      if (!sourceProductDepots.includes(sourceDepotId)) {
        return null; // Skip if product not assigned to this depot
      }

      try {
        return await firstValueFrom(this.productsService.createProductDepotLink({
          sourceProductId: this.selectedSourceProduct!.id,
          sourceDepotId: sourceDepotId,
          destinationProductId: this.selectedProductForDepot!.id,
          destinationDepotId: destinationDepotId
        }));
      } catch (error: any) {
        console.error(`Error creating link for depot ${sourceDepotId}:`, error);
        throw error;
      }
    });

    Promise.all(linkPromises).then(() => {
      this.closeAddToDepotModal();
      this.loadProducts();
      this.loading = false;
    }).catch((error) => {
      this.error = error.error?.error || 'Erreur lors de la création du lien';
      this.loading = false;
    });
  }
} 