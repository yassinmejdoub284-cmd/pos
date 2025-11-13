import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { Product, ProductFamily, ProductDepotPrice } from '../../../core/models/product.model';
import { Depot } from '../../../core/models/depot.model';
import { DepotsService } from '../../../core/services/depots.service';
import { AuthService } from '../../../core/services/auth.service';

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
  imageInputType: 'file' | 'url' = 'file';
  selectedDepotIds = signal<number[]>([]);
  depotPrices = signal<Map<number, number>>(new Map()); // Map<depotId, price>
  showTransferSection = signal(false);

  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService,
    private depotsService: DepotsService,
    private authService: AuthService
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
      duree_conservation: [null],
      isVraguable: [false],
      conversionRatio: [null],
      prix_vente_vrac: [0, [Validators.min(0)]],
      prix_achat_vrac: [0, [Validators.min(0)]],
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
    this.loadFamilies();
    this.loadDepots();
    this.initializeSelectedDepots();
    this.initializeDepotPrices();
    this.initializeForm();
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
        conversionRatio: this.product.conversionRatio || null,
        prix_vente_vrac: this.product.prix_vente_vrac || 0,
        prix_achat_vrac: this.product.prix_achat_vrac || 0,
        isStockable: this.product.isStockable || false,
        // Wholesale fields
        isWholesale: this.product.isWholesale || false,
        bundleSize: this.product.bundleSize || null,
        bundlePrice: this.product.bundlePrice || null
      });
      
      // Set initial disabled state based on vraguable status
      const isVraguable = this.product.isVraguable || false;
      const stockableControl = this.productForm.get('isStockable');
      const conversionRatioControl = this.productForm.get('conversionRatio');
      if (!isVraguable) {
        stockableControl?.disable();
        conversionRatioControl?.clearValidators();
      } else {
        stockableControl?.enable();
        conversionRatioControl?.setValidators([Validators.required, Validators.min(0.001)]);
      }
      conversionRatioControl?.updateValueAndValidity();
      
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
          this.depots = depots.filter(d => d.isActive && d.type === 'SHOP');
        },
        error: (error) => {
          console.error('Error loading depots:', error);
        }
      });
    } else {
      // Non-admin users can only see their assigned depot
      const userDepotId = currentUser?.depotId;
      if (userDepotId) {
        this.depotsService.get(userDepotId).subscribe({
          next: (depot) => {
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
    
    if (this.product && this.product.depotPrices && this.product.depotPrices.length > 0) {
      this.product.depotPrices.forEach(depotPrice => {
        pricesMap.set(depotPrice.depotId, depotPrice.prix_vente_TTC);
      });
    }
    
    // If no depot prices exist, use default price for selected depots
    if (pricesMap.size === 0 && this.selectedDepotIds().length > 0) {
      const defaultPrice = this.product?.prix_vente_TTC || this.productForm.get('prix_vente_TTC')?.value || 0;
      this.selectedDepotIds().forEach(depotId => {
        pricesMap.set(depotId, defaultPrice);
      });
    }
    
    this.depotPrices.set(pricesMap);
  }

  onDepotPriceChange(depotId: number, price: number): void {
    // Only allow price changes for admins
    if (!this.authService.isAdmin()) {
      return;
    }
    
    const currentPrices = this.depotPrices();
    const newPrices = new Map(currentPrices);
    newPrices.set(depotId, price);
    this.depotPrices.set(newPrices);
  }

  getDepotPrice(depotId: number): number {
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
      const formData = this.productForm.getRawValue();
      
      // Only allow depot and price modifications for admins
      if (this.authService.isAdmin()) {
        formData.depotIds = this.selectedDepotIds();
        
        // Add depot prices
        const depotPricesArray = Array.from(this.depotPrices().entries()).map(([depotId, prix_vente_TTC]) => ({
          depotId,
          prix_vente_TTC
        }));
        formData.depotPrices = depotPricesArray;
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
      
      console.log('Form data being sent:', formData);

      const saveProduct = () => {
        if (this.product) {
          this.productsService.updateProduct(this.product.id, formData).subscribe({
            next: (product) => {
              this.loading.set(false);
              this.saved.emit(product);
            },
            error: (error) => {
              this.loading.set(false);
              this.error.set('Erreur lors de la mise à jour du produit');
            }
          });
        } else {
          this.productsService.createProduct(formData).subscribe({
            next: (product) => {
              this.loading.set(false);
              this.saved.emit(product);
            },
            error: (error) => {
              this.loading.set(false);
              this.error.set('Erreur lors de la création du produit');
            }
          });
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
    const conversionRatioControl = this.productForm.get('conversionRatio');
    
    if (!isVraguable) {
      this.productForm.patchValue({ 
        isStockable: false, 
        conversionRatio: null,
        prix_vente_vrac: 0,
        prix_achat_vrac: 0
      });
      stockableControl?.disable();
      conversionRatioControl?.clearValidators();
    } else {
      stockableControl?.enable();
      conversionRatioControl?.setValidators([Validators.required, Validators.min(0.001)]);
    }
    conversionRatioControl?.updateValueAndValidity();
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

    const transferPayload = {
      sourceProductId: this.product.id,
      transfers: transfers,
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