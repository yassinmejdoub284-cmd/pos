import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { ProduitsDeCaisseService } from '../../../core/services/produits-de-caisse.service';
import { Product, ProductFamily, ProductDepotPrice } from '../../../core/models/product.model';
import { Depot } from '../../../core/models/depot.model';
import { DepotsService } from '../../../core/services/depots.service';
import { AuthService } from '../../../core/services/auth.service';
import { SessionsService } from '../../../core/services/sessions.service';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css'],
  standalone: false

})
export class ProductFormComponent implements OnInit, OnChanges {
  @Input() product: Product | null = null;
  @Output() saved = new EventEmitter<Product>();
  @Output() cancelled = new EventEmitter<void>();

  productForm: FormGroup;
  loading = signal(false);
  error = signal('');
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  families: ProductFamily[] = [];
  depots: Depot[] = [];
  userDepot: Depot | null = null;
  imageInputType: 'file' | 'url' = 'file';
  selectedDepotIds = signal<number[]>([]);
  depotPrices = signal<Map<number, number>>(new Map()); // Map<depotId, price>
  depotPriceInputs = signal<Map<number, string | number>>(new Map()); // Map<depotId, inputValue> - allows empty string
  showTransferSection = signal(false);
  isResponsableMagasin = signal(false);
  sessionDepotId = signal<number | null>(null);

  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService,
    private produitsDeCaisseService: ProduitsDeCaisseService,
    private depotsService: DepotsService,
    private authService: AuthService,
    private sessionsService: SessionsService
  ) {
    this.productForm = this.fb.group({
      name: ['', Validators.required],
      designation_legale: [''],
      description: [''],
      familleId: [null, Validators.required],
      barcode: [''],
      unite: ['pcs', Validators.required],
      prix_vente_TTC: [0, [Validators.required, Validators.min(0)]],
      prix_achat: [null, [Validators.min(0)]],
      tva: [19, [Validators.required, Validators.min(0), Validators.max(100)]],
      isVraguable: [false],
      isStockable: [false],
      // Wholesale fields
      isWholesale: [false],
      bundleSize: [null],
      bundlePrice: [null],
      // Image fields
      photoUrl: ['']
    });
  }

  ngOnInit(): void {
    this.checkResponsableMagasin();
    this.loadSessionDepotId();
    this.loadFamilies();
    this.loadDepots();
    this.initializeSelectedDepots();
    this.initializeDepotPrices();
    this.initializeForm();
  }

  private checkResponsableMagasin(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.isResponsableMagasin.set(false);
      return;
    }
    
    // Check roleKey first (stored in user-roles.json), then role as string
    const roleKey = (user as any).roleKey;
    const role = String(user.role || '');
    const isResponsable = roleKey === 'RESPONSABLE_MAGASIN' || role === 'RESPONSABLE_MAGASIN';
    this.isResponsableMagasin.set(isResponsable);
  }

  private loadSessionDepotId(): void {
    if (this.isResponsableMagasin()) {
      // Try to get depotId from active session first
      const session = this.sessionsService.currentSession();
      if (session?.depotId) {
        this.sessionDepotId.set(session.depotId);
        return;
      }
      
      // Try to get from visitingDepotId in sessionStorage
      const visitingDepotId = sessionStorage.getItem('visitingDepotId');
      if (visitingDepotId) {
        const parsed = parseInt(visitingDepotId);
        if (!isNaN(parsed)) {
          this.sessionDepotId.set(parsed);
          return;
        }
      }
      
      // Fallback to user's depotId
      const user = this.authService.currentUser();
      if (user?.depotId) {
        this.sessionDepotId.set(user.depotId);
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && !changes['product'].firstChange) {
      // Product input changed, reinitialize depots and form
      this.initializeSelectedDepots();
      this.initializeDepotPrices();
      this.initializeForm();
    }
  }

  private initializeForm(): void {
    if (this.product) {
      this.productForm.patchValue({
        ...this.product,
        familleId: this.product.familleId,
        designation_legale: this.product.designation_legale || '',
        isVraguable: this.product.isVraguable || false,
        isStockable: this.product.isStockable || false,
        // Wholesale fields
        isWholesale: this.product.isWholesale || false,
        bundleSize: this.product.bundleSize || null,
        bundlePrice: this.product.bundlePrice || null
      });
      
      // Set initial disabled state based on vraguable status
      const isVraguable = this.product.isVraguable || false;
      const stockableControl = this.productForm.get('isStockable');
      if (!isVraguable) {
        stockableControl?.disable();
      } else {
        stockableControl?.enable();
      }
      
      if (this.product.photo) {
        this.imagePreview = this.product.photo;
      }
      
      // Initialize wholesale state
      this.onWholesaleChange();
    } else {
      // For new products, disable stockable by default
      this.productForm.get('isStockable')?.disable();
    }
  }

  loadFamilies(): void {
    this.productsService.getFamilles().subscribe({
      next: (families) => {
        this.families = families;
        if (!this.product && families.length > 0) {
          this.productForm.patchValue({ familleId: families[0].id });
        }
      },
      error: (error) => {
        this.error.set('Erreur lors du chargement des familles');
      }
    });
  }

  loadDepots(): void {
    const isAdmin = this.authService.isAdmin();
    const currentUser = this.authService.currentUser();
    
    if (isAdmin) {
      // Admin can see and select all depots
      this.depotsService.list().subscribe({
        next: (depots) => {
          this.depots = depots.filter(d => d.isActive);
        },
        error: (error) => {
          console.error('Error loading depots:', error);
        }
      });
    } else {
      // Non-admin users can see their assigned depot (all types, not just SHOP)
      const userDepotId = currentUser?.depotId;
      if (userDepotId) {
        this.depotsService.get(userDepotId).subscribe({
          next: (depot) => {
            this.userDepot = depot;
            this.depots = [depot];
            // Auto-assign user's depot if no depots are selected
            if (this.selectedDepotIds().length === 0) {
              this.selectedDepotIds.set([userDepotId]);
              this.initializeDepotPrices();
            }
          },
          error: (error) => {
            console.error('Error loading user depot:', error);
          }
        });
      }
    }
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  generateBarcode(): void {
    this.productsService.generateBarcode().subscribe({
      next: (response) => {
        this.productForm.patchValue({ barcode: response.barcode });
      },
      error: (error) => {
        this.error.set('Erreur lors de la génération du code-barres');
      }
    });
  }

  initializeSelectedDepots(): void {
    const isAdmin = this.authService.isAdmin();
    const currentUser = this.authService.currentUser();
    
    if (this.product && this.product.assignedDepots && this.product.assignedDepots.length > 0) {
      const depotIds = this.product.assignedDepots.map(depot => depot.id);
      if (isAdmin) {
        // Admin can see all assigned depots
        this.selectedDepotIds.set(depotIds);
      } else {
        // Non-admin can only see their own depot
        const userDepotId = currentUser?.depotId;
        if (userDepotId && depotIds.includes(userDepotId)) {
          this.selectedDepotIds.set([userDepotId]);
        } else {
          this.selectedDepotIds.set([]);
        }
      }
    } else {
      // For new products, auto-assign user's depot for non-admins
      if (!isAdmin && currentUser?.depotId) {
        this.selectedDepotIds.set([currentUser.depotId]);
      } else {
        this.selectedDepotIds.set([]);
      }
    }
  }

  onDepotsSelected(depotIds: number[]): void {
    // Only allow depot selection for admins
    if (!this.authService.isAdmin()) {
      return;
    }
    
    this.selectedDepotIds.set(depotIds);
    // Initialize prices for newly selected depots if not already set
    const currentPrices = this.depotPrices();
    const defaultPrice = this.productForm.get('prix_vente_TTC')?.value || 0;
    const newPrices = new Map(currentPrices);
    
    depotIds.forEach(depotId => {
      if (!newPrices.has(depotId)) {
        newPrices.set(depotId, defaultPrice);
      }
    });
    
    // Remove prices for unselected depots
    Array.from(newPrices.keys()).forEach(depotId => {
      if (!depotIds.includes(depotId)) {
        newPrices.delete(depotId);
      }
    });
    
    this.depotPrices.set(newPrices);
  }

  initializeDepotPrices(): void {
    const pricesMap = new Map<number, number>();
    const inputMap = new Map<number, string | number>();
    
    if (this.product && this.product.depotPrices && this.product.depotPrices.length > 0) {
      this.product.depotPrices.forEach(depotPrice => {
        pricesMap.set(depotPrice.depotId, depotPrice.prix_vente_TTC);
        inputMap.set(depotPrice.depotId, depotPrice.prix_vente_TTC);
      });
    }
    
    // If no depot prices exist, use default price for selected depots
    if (pricesMap.size === 0 && this.selectedDepotIds().length > 0) {
      const defaultPrice = this.product?.prix_vente_TTC || this.productForm.get('prix_vente_TTC')?.value || 0;
      this.selectedDepotIds().forEach(depotId => {
        pricesMap.set(depotId, defaultPrice);
        inputMap.set(depotId, defaultPrice);
      });
    }
    
    this.depotPrices.set(pricesMap);
    this.depotPriceInputs.set(inputMap);
  }

  onDepotPriceChange(depotId: number, price: number | string, isBlur: boolean = false): void {
    // Allow price changes for admins or RESPONSABLE_MAGASIN for their own depot
    const isAdmin = this.authService.isAdmin();
    const isResponsable = this.isResponsableMagasin();
    const userDepotId = this.sessionDepotId();
    
    if (!isAdmin && !isResponsable) {
      return;
    }
    
    // RESPONSABLE_MAGASIN can only change prices for their own depot
    if (isResponsable && !isAdmin && depotId !== userDepotId) {
      return;
    }
    
    // Update input map immediately to allow clearing the field
    const currentInputs = this.depotPriceInputs();
    const newInputs = new Map(currentInputs);
    newInputs.set(depotId, price);
    this.depotPriceInputs.set(newInputs);
    
    // Handle empty string or invalid values
    // During typing, allow empty string temporarily
    // On blur, convert empty to 0 and update the price map
    if (isBlur || (price !== '' && price !== null && price !== undefined)) {
      let priceValue: number;
      if (price === '' || price === null || price === undefined) {
        priceValue = 0;
      } else {
        const parsed = typeof price === 'string' ? parseFloat(price) : price;
        priceValue = isNaN(parsed) ? 0 : parsed;
      }
      
      const currentPrices = this.depotPrices();
      const newPrices = new Map(currentPrices);
      newPrices.set(depotId, priceValue);
      this.depotPrices.set(newPrices);
      
      // Update input map with the final value
      newInputs.set(depotId, priceValue);
      this.depotPriceInputs.set(newInputs);
    }
  }

  getDepotPrice(depotId: number): number | string {
    // Return input value if available (allows empty string), otherwise return price
    const inputValue = this.depotPriceInputs().get(depotId);
    if (inputValue !== undefined) {
      return inputValue;
    }
    return this.depotPrices().get(depotId) || this.productForm.get('prix_vente_TTC')?.value || 0;
  }

  getDepotName(depotId: number): string {
    const depot = this.depots.find(d => d.id === depotId);
    return depot ? depot.name : `Dépôt ${depotId}`;
  }

  onSubmit(): void {
    if (this.productForm.valid && this.selectedDepotIds().length > 0) {
      this.loading.set(true);
      this.error.set('');

      // Get all form values including disabled controls
      let formData = this.productForm.getRawValue();
      
      const isAdmin = this.authService.isAdmin();
      const isResponsable = this.isResponsableMagasin();
      const userDepotId = this.sessionDepotId();
      
      // Allow depot and price modifications for admins or RESPONSABLE_MAGASIN for their depot
      if (isAdmin) {
        formData.depotIds = this.selectedDepotIds();
        
        // Add depot prices
        const depotPricesArray = Array.from(this.depotPrices().entries()).map(([depotId, prix_vente_TTC]) => ({
          depotId,
          prix_vente_TTC
        }));
        formData.depotPrices = depotPricesArray;
      } else if (isResponsable && userDepotId) {
        // RESPONSABLE_MAGASIN can only modify their own depot price
        // Get the price for their depot from the depotPrices map
        const userDepotPrice = this.depotPrices().get(userDepotId);
        const defaultPrice = this.productForm.get('prix_vente_TTC')?.value || 0;
        const finalPrice = userDepotPrice !== undefined ? userDepotPrice : defaultPrice;
        
        // Only send their depot price
        formData.depotPrices = [{
          depotId: userDepotId,
          prix_vente_TTC: finalPrice
        }];
        
        // Don't send depotIds - keep existing assignments
        delete formData.depotIds;
      } else {
        // Non-admins cannot modify depot assignments or prices
        // Keep existing depot assignments and prices from the product
        if (this.product) {
          formData.depotIds = this.product.assignedDepots?.map(d => d.id) || [];
          formData.depotPrices = this.product.depotPrices?.map(dp => ({
            depotId: dp.depotId,
            prix_vente_TTC: dp.prix_vente_TTC
          })) || [];
        } else {
          // For new products, use user's depot
          const userDepotId = this.authService.currentUser()?.depotId;
          if (userDepotId) {
            formData.depotIds = [userDepotId];
            const defaultPrice = this.productForm.get('prix_vente_TTC')?.value || 0;
            formData.depotPrices = [{
              depotId: userDepotId,
              prix_vente_TTC: defaultPrice
            }];
          }
        }
      }
      


      const saveProduct = () => {
        if (this.product) {
          // For RESPONSABLE_MAGASIN, ensure we have depotPrices
          if (this.isResponsableMagasin() && !this.authService.isAdmin()) {
            const userDepotId = this.sessionDepotId();
            if (!userDepotId) {
              this.loading.set(false);
              this.error.set('Aucun dépôt trouvé pour votre session');
              return;
            }
            
            // Ensure depotPrices is set and contains their depot
            if (!formData.depotPrices || !Array.isArray(formData.depotPrices) || formData.depotPrices.length === 0) {
              const userDepotPrice = this.depotPrices().get(userDepotId);
              const defaultPrice = this.productForm.get('prix_vente_TTC')?.value || 0;
              formData.depotPrices = [{
                depotId: userDepotId,
                prix_vente_TTC: userDepotPrice !== undefined ? userDepotPrice : defaultPrice
              }];
            }
            
            // Create a clean request with only allowed fields
            const cleanFormData: any = {
              depotId: userDepotId,
              depotPrices: formData.depotPrices
            };
            formData = cleanFormData;
          }
          
          this.productsService.updateProduct(this.product.id, formData).subscribe({
            next: (product) => {
              this.loading.set(false);
              this.saved.emit(product);
            },
            error: (error) => {
              this.loading.set(false);
              const errorMessage = error?.error?.error || error?.message || 'Erreur lors de la mise à jour du produit';
              this.error.set(errorMessage);
              console.error('Error updating product:', error);
            }
          });
        } else {
          // Determine which API to use based on depot type
          const depotIdsToUse = formData.depotIds && formData.depotIds.length > 0 ? formData.depotIds : 
            (this.userDepot ? [this.userDepot.id] : []);
          
          if (depotIdsToUse.length === 0) {
            this.loading.set(false);
            this.error.set('Veuillez sélectionner au moins un dépôt');
            return;
          }
          
          // Get depot info to determine type
          const firstDepotId = depotIdsToUse[0];
          const selectedDepot = this.depots.find(d => d.id === firstDepotId) || this.userDepot;
          
          if (selectedDepot && selectedDepot.type !== 'SHOP') {
            // For non-SHOP depots (MAIN, BRANCH, WAREHOUSE), use ProduitDeCaisse
            
            const produitData = {
              name: formData.name,
              designation_legale: formData.designation_legale || null,
              description: formData.description || null,
              familleId: formData.familleId,
              barcode: formData.barcode || null,
              unite: formData.unite || 'pcs',
              prix_vente_TTC: formData.prix_vente_TTC,
              prix_achat: formData.prix_achat || null,
              tva: formData.tva || 19,
              photo: formData.photo || null,
              isVrac: formData.isVrac || false,
              isVraguable: formData.isVraguable || false,
              isStockable: formData.isStockable !== undefined ? formData.isStockable : true,
              isWholesale: formData.isWholesale || false,
              bundleSize: formData.bundleSize || null,
              bundlePrice: formData.bundlePrice || null,
              depotIds: depotIdsToUse,
              isActive: true
            };
            
            this.produitsDeCaisseService.createProduitDeCaisse(produitData).subscribe({
              next: (produit) => {
                // Transform ProduitDeCaisse to Product format for compatibility
                const product: Product = {
                  id: produit.id,
                  name: produit.name,
                  barcode: produit.barcode || undefined,
                  prix_vente_TTC: produit.prix_vente_TTC,
                  prix_achat: produit.prix_achat || undefined,
                  unite: produit.unite,
                  tva: produit.tva,
                  familleId: produit.familleId,
                  famille: produit.famille ? { 
                    id: produit.famille.id, 
                    name: produit.famille.name,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  } : undefined,
                  assignedDepots: produit.assignedDepots || [],
                  depotAssignments: produit.depotAssignments?.filter(da => da.depot).map(da => ({
                    id: da.id,
                    productId: da.produitDeCaisseId,
                    depotId: da.depotId,
                    depot: da.depot!,
                    createdAt: da.createdAt,
                    updatedAt: da.updatedAt
                  })) || [],
                  isVrac: produit.isVrac,
                  isVraguable: produit.isVraguable,
                  isStockable: produit.isStockable,
                  isWholesale: produit.isWholesale,
                  bundleSize: produit.bundleSize || undefined,
                  bundlePrice: produit.bundlePrice || undefined,
                  photo: produit.photo || undefined,
                  description: produit.description || undefined,
                  designation_legale: produit.designation_legale || undefined,
                  minStock: produit.minStock || undefined,
                  maxStock: produit.maxStock || undefined,
                  initialStock: produit.initialStock || undefined,
                  displayIndex: produit.displayIndex || undefined,
                  createdAt: produit.createdAt,
                  updatedAt: produit.updatedAt
                };
                this.loading.set(false);
                this.saved.emit(product);
              },
              error: (error) => {
                console.error('Error creating produit de caisse:', error);
                this.loading.set(false);
                this.error.set(error.error?.error || 'Erreur lors de la création du produit');
              }
            });
          } else {
            // For SHOP depots, use Product table
            this.productsService.createProduct(formData).subscribe({
              next: (product) => {
                this.loading.set(false);
                this.saved.emit(product);
              },
              error: (error) => {
                this.loading.set(false);
                this.error.set(error.error?.error || 'Erreur lors de la création du produit');
              }
            });
          }
        }
      };

      // Handle image - either file upload or URL
      if (this.selectedFile) {
        this.productsService.uploadImage(this.selectedFile).subscribe({
          next: (response) => {
            formData.photo = response.imageUrl;
            saveProduct();
          },
          error: (error) => {
            this.loading.set(false);
            this.error.set('Erreur lors du téléchargement de l\'image');
          }
        });
      } else if (this.imageInputType === 'url' && this.productForm.get('photoUrl')?.value) {
        formData.photo = this.productForm.get('photoUrl')?.value;
        saveProduct();
      } else {
        saveProduct();
      }
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  get isVraguable(): boolean {
    return this.productForm.get('isVraguable')?.value || false;
  }

  get isStockable(): boolean {
    return this.productForm.get('isStockable')?.value || false;
  }

  onVraguableChange(): void {
    const isVraguable = this.productForm.get('isVraguable')?.value;
    const stockableControl = this.productForm.get('isStockable');
    
    if (!isVraguable) {
      this.productForm.patchValue({ 
        isStockable: false
      });
      stockableControl?.disable();
    } else {
      stockableControl?.enable();
    }
  }

  onStockableChange(): void {
    // Stock management logic can be added here if needed in the future
  }

  onWholesaleChange(): void {
    const isWholesale = this.productForm.get('isWholesale')?.value;
    const bundleSizeControl = this.productForm.get('bundleSize');
    const bundlePriceControl = this.productForm.get('bundlePrice');
    
    if (!isWholesale) {
      // Clear wholesale fields when disabled
      this.productForm.patchValue({
        bundleSize: null,
        bundlePrice: null
      });
      bundleSizeControl?.clearValidators();
      bundlePriceControl?.clearValidators();
    } else {
      // Add validators for wholesale fields
      bundleSizeControl?.setValidators([Validators.required, Validators.min(1)]);
      bundlePriceControl?.setValidators([Validators.required, Validators.min(0)]);
    }
    
    bundleSizeControl?.updateValueAndValidity();
    bundlePriceControl?.updateValueAndValidity();
  }

  setImageInputType(type: 'file' | 'url'): void {
    this.imageInputType = type;
    if (type === 'file') {
      this.productForm.get('photoUrl')?.setValue('');
    } else {
      this.selectedFile = null;
    }
  }

  loadImageFromUrl(): void {
    const url = this.productForm.get('photoUrl')?.value;
    if (url && this.isValidImageUrl(url)) {
      this.imagePreview = url;
      this.selectedFile = null;
    } else {
      this.error.set('URL d\'image invalide');
    }
  }

  clearImage(): void {
    this.imagePreview = null;
    this.selectedFile = null;
    this.productForm.get('photoUrl')?.setValue('');
  }

  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const validProtocols = ['http:', 'https:'];
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      
      if (!validProtocols.includes(urlObj.protocol)) {
        return false;
      }
      
      const pathname = urlObj.pathname.toLowerCase();
      return validExtensions.some(ext => pathname.endsWith(ext)) || 
             pathname.includes('image') || 
             url.includes('placeholder');
    } catch {
      return false;
    }
  }

  toggleTransferSection(): void {
    this.showTransferSection.set(!this.showTransferSection());
  }

  onMultiTransfer(transfers: Array<{
    targetProductId: number;
    quantity: number;
    conversionRatio: number;
  }>): void {
    if (!this.product || transfers.length === 0) return;

    this.loading.set(true);
    this.error.set('');

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : userDepotId;

    const transfersPayload = transfers.map(transfer => {
      const sourceQuantity = transfer.conversionRatio > 0 
        ? transfer.quantity / transfer.conversionRatio 
        : transfer.quantity;
      
      return {
        targetProductId: transfer.targetProductId,
        quantity: sourceQuantity,
        conversionRatio: transfer.conversionRatio
      };
    });

    const transferPayload = {
      sourceProductId: this.product.id,
      transfers: transfersPayload,
      depotId: currentDepotId
    };

    this.productsService.transferProductMultiple(transferPayload).subscribe({
      next: () => {
        this.loading.set(false);
        this.showTransferSection.set(false);
        this.error.set('');
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(error.error?.error || 'Erreur lors du transfert des produits');
      }
    });
  }
} 