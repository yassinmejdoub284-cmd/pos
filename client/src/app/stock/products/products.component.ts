import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../../core/services/products.service';
import { ProduitsDeCaisseService } from '../../core/services/produits-de-caisse.service';
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
  searchProductName = '';
  families: ProductFamily[] = [];
  viewMode: 'table' | 'grid' = 'table';
  depots: Depot[] = [];
  selectedDepotId: number | null = null;
  // Palette classes for family badges (light vibrant colors)
  private familyColorClasses: string[] = [
    'bg-gradient-to-r from-pink-100 to-rose-200 text-rose-800 border border-rose-200',
    'bg-gradient-to-r from-purple-100 to-violet-200 text-violet-800 border border-violet-200',
    'bg-gradient-to-r from-indigo-100 to-blue-200 text-indigo-800 border border-indigo-200',
    'bg-gradient-to-r from-emerald-100 to-green-200 text-emerald-800 border border-emerald-200',
    'bg-gradient-to-r from-amber-100 to-orange-200 text-amber-800 border border-amber-200',
    'bg-gradient-to-r from-cyan-100 to-sky-200 text-cyan-800 border border-cyan-200'
  ];

  // Palette classes for depot badges (distinct from families)
  private depotColorClasses: string[] = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    'bg-lime-100 text-lime-800 border-lime-200',
    'bg-orange-100 text-orange-800 border-orange-200'
  ];

  constructor(
    private productsService: ProductsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
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
      // First, get depot info to determine if it's SHOP or not
      const selectedDepot = this.depots.find(d => d.id === this.selectedDepotId);
      
      if (!selectedDepot) {
        console.error('Selected depot not found in depots list:', this.selectedDepotId);
        this.error = 'Dépôt sélectionné introuvable';
        this.loading = false;
        return;
      }
      
      if (selectedDepot.type === 'SHOP') {
        // For SHOP depots, use Product table
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
            this.applyFilters();
            this.loading = false;
          },
          error: (error) => {
            console.error('Error loading products:', error);
            this.error = 'Erreur lors du chargement des produits';
            this.loading = false;
          }
        });
      } else {
        // For non-SHOP depots (MAIN, BRANCH, WAREHOUSE), use ProduitDeCaisse table
        this.produitsDeCaisseService.getProduitsDeCaisse(this.selectedDepotId!).subscribe({
          next: (produits) => {
            // Transform ProduitDeCaisse to Product format for compatibility
            this.allProducts = produits.map(produit => ({
              id: produit.id,
              name: produit.name,
              barcode: produit.barcode,
              prix_vente_TTC: produit.prix_vente_TTC,
              prix_achat: produit.prix_achat,
              unite: produit.unite,
              tva: produit.tva,
              familleId: produit.familleId,
              famille: produit.famille ? { id: produit.famille.id, name: produit.famille.name } : null,
              assignedDepots: produit.assignedDepots || [],
              depotAssignments: produit.depotAssignments?.map(da => ({ depot: da.depot })) || [],
              isVrac: produit.isVrac,
              isVraguable: produit.isVraguable,
              isStockable: produit.isStockable,
              isWholesale: produit.isWholesale,
              bundleSize: produit.bundleSize,
              bundlePrice: produit.bundlePrice,
              photo: produit.photo,
              description: produit.description,
              designation_legale: produit.designation_legale,
              minStock: produit.minStock,
              maxStock: produit.maxStock,
              initialStock: produit.initialStock,
              displayIndex: produit.displayIndex
            } as Product));
            this.applyFilters();
            this.loading = false;
          },
          error: (error) => {
            console.error('Error loading produits de caisse:', error);
            this.error = 'Erreur lors du chargement des produits';
            this.loading = false;
          }
        });
      }
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

  getDepotColor(depotId: number): string {
    const index = depotId % this.depotColorClasses.length;
    return this.depotColorClasses[index];
  }

  getDepotName(depotId: number): string {
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.name : `Dépôt ${depotId}`;
  }

  getDepotShortName(depotId: number): string {
    const depot = this.depots.find(d => d.id === depotId);
    if (!depot) return `D${depotId}`;
    
    // Create a short code from the name (e.g. "Boutique Centre Ville" -> "BCV")
    return depot.name
      .split(' ')
      .map(word => word[0].toUpperCase())
      .join('')
      .substring(0, 3);
  }

  getDepotPrice(product: Product, depotId: number): number | undefined {
    if (!product.depotPrices || product.depotPrices.length === 0) return undefined;
    const depotPrice = product.depotPrices.find(dp => dp.depotId === depotId);
    return depotPrice ? Number(depotPrice.prix_vente_TTC) : undefined;
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

  getVracConversionsCount(product: Product): number {
    return product.vracConversionsAsSource?.length || 0;
  }

  hasVracConversions(product: Product): boolean {
    return this.getVracConversionsCount(product) > 0;
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
      product.isVraguable === true || this.hasVracConversions(product)
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
    this.showAddToDepotModal = true;
  }

  getAvailableDepots(): Depot[] {
    if (!this.selectedProductForDepot) {
      return this.depots;
    }
    const assignedDepotIds = this.selectedProductForDepot.assignedDepots?.map(d => d.id) || [];
    return this.depots.filter(depot => !assignedDepotIds.includes(depot.id));
  }

  getAllDepotsForDestination(): Depot[] {
    return this.depots.filter(d => d.isActive);
  }

  getSelectedProductAssignedDepots(): ProductDepot[] {
    return this.selectedProductForDepot?.assignedDepots || [];
  }

  closeAddToDepotModal(): void {
    this.showAddToDepotModal = false;
    this.selectedProductForDepot = null;
    this.selectedDepotForAssignment = null;
  }

  addProductToDepot(): void {
    if (!this.selectedProductForDepot) {
      this.error = 'Aucun produit sélectionné';
      return;
    }

    if (!this.selectedDepotForAssignment) {
      this.error = 'Veuillez sélectionner un dépôt destination';
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
}
 