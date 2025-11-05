import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { Product, ProductFamily } from '../../../core/models/product.model';
import { Depot } from '../../../core/models/depot.model';

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
  imageInputType: 'file' | 'url' = 'file';
  selectedDepotIds = signal<number[]>([]);

  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService
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
    this.initializeSelectedDepots();
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && !changes['product'].firstChange) {
      // Product input changed, reinitialize depots and form
      this.initializeSelectedDepots();
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
    if (this.product && this.product.assignedDepots && this.product.assignedDepots.length > 0) {
      const depotIds = this.product.assignedDepots.map(depot => depot.id);
      this.selectedDepotIds.set(depotIds);
    } else {
      // Reset to empty array if no depots assigned
      this.selectedDepotIds.set([]);
    }
  }

  onDepotsSelected(depotIds: number[]): void {
    this.selectedDepotIds.set(depotIds);
  }

  onSubmit(): void {
    if (this.productForm.valid && this.selectedDepotIds().length > 0) {
      this.loading.set(true);
      this.error.set('');

      // Get all form values including disabled controls
      const formData = this.productForm.getRawValue();
      formData.depotIds = this.selectedDepotIds();
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
    
    if (!isVraguable) {
      this.productForm.patchValue({ isStockable: false });
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
} 