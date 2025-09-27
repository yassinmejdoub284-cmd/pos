import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProduitDeStock } from '../../../core/models/produit-de-caisse.model';
import { Product } from '../../../core/models/product.model';
import { Depot } from '../../../core/models/depot.model';
import { ProduitsDeStockService } from '../../../core/services/produits-de-caisse.service';
import { ProductsService } from '../../../core/services/products.service';

@Component({
  selector: 'app-produits-de-stock-form',
  templateUrl: './produits-de-caisse-form.component.html',
  styleUrls: ['./produits-de-caisse-form.component.css'],
  standalone: false
})
export class ProduitsDeStockFormComponent implements OnInit {
  @Input() produit: ProduitDeStock | null = null;
  @Input() allProducts: Product[] = [];
  @Input() parentProduct: Product | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private produitsDeStockService = inject(ProduitsDeStockService);
  private productsService = inject(ProductsService);

  form!: FormGroup;
  loading = signal(false);
  error = signal('');
  selectedDepotIds = signal<number[]>([]);
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  imageInputType: 'file' | 'url' = 'file';

  ngOnInit(): void {
    this.initializeForm();
    this.initializeSelectedDepots();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      name: [this.produit?.name || '', [Validators.required, Validators.minLength(2)]],
      parentProductId: [this.produit?.parentProductId || this.parentProduct?.id || null, Validators.required],
      prix_achat: [this.produit?.prix_achat || null, [Validators.min(0)]],
      prix_vente_TTC: [this.produit?.prix_vente_TTC || 0, [Validators.required, Validators.min(0)]],
      tva: [this.produit?.tva || 19, [Validators.required, Validators.min(0), Validators.max(100)]],
      isActive: [this.produit?.isActive ?? true],
      // Image fields
      photoUrl: ['']
    });
    
    // Set initial image preview if editing
    if (this.produit?.photo) {
      this.imagePreview = this.produit.photo;
    }
  }

  private initializeSelectedDepots(): void {
    if (this.produit?.assignedDepots) {
      const depotIds = this.produit.assignedDepots.map(depot => depot.id);
      this.selectedDepotIds.set(depotIds);
    }
  }



  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = '/images/placeholder-product.svg';
  }

  onDepotsSelected(depotIds: number[]): void {
    this.selectedDepotIds.set(depotIds);
  }

  onSubmit(): void {
    if (this.form.valid && this.selectedDepotIds().length > 0) {
      this.loading.set(true);
      this.error.set('');

      // Get all form values including disabled controls
      const formData = this.form.getRawValue();
      
      
      const baseRequest: any = {
        name: formData.name,
        designation_legale: '',
        description: '',
        familleId: null, // Will be set by server to default family
        barcode: '',
        unite: 'pcs',
        prix_vente_TTC: formData.prix_vente_TTC,
        prix_achat: formData.prix_achat,
        tva: formData.tva,
        photo: this.produit?.photo || undefined,
        duree_conservation: null,
        isVrac: false,
        originalProductId: null,
        parentProductId: formData.parentProductId ? parseInt(formData.parentProductId) : null,
        isStockable: true,
        isVraguable: false,
        initialStock: null,
        minStock: null,
        maxStock: null,
        displayIndex: null,
        isWholesale: false,
        bundleSize: null,
        bundlePrice: null,
        productIds: [],
        depotIds: this.selectedDepotIds(),
        isActive: formData.isActive
      };

      const saveProduit = (photoUrl?: string) => {
        // Check if depotIds is valid
        if (!baseRequest.depotIds || baseRequest.depotIds.length === 0) {
          this.error.set('Veuillez sélectionner au moins un dépôt');
          this.loading.set(false);
          return;
        }
        
        // Create single product
        const request = {
          ...baseRequest,
          photo: photoUrl || baseRequest.photo
        };
        
        const operation = this.produit 
          ? this.produitsDeStockService.updateProduitDeStock(this.produit.id, request)
          : this.produitsDeStockService.createProduitDeStock(request);

        operation.subscribe({
          next: () => {
            this.submit.emit();
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Error saving produit:', err);
            console.error('Error details:', err.error);
            this.error.set(err.error?.error || 'Erreur lors de la sauvegarde');
            this.loading.set(false);
          }
        });
      };

      // Handle image - either file upload or URL
      if (this.selectedFile) {
        this.produitsDeStockService.uploadImage(this.selectedFile).subscribe({
          next: (response) => {
            saveProduit(response.imageUrl);
          },
          error: (error) => {
            this.loading.set(false);
            this.error.set('Erreur lors du téléchargement de l\'image');
          }
        });
      } else if (this.imageInputType === 'url' && this.form.get('photoUrl')?.value) {
        saveProduit(this.form.get('photoUrl')?.value);
      } else {
        saveProduit();
      }
    } else {
      const errorMessage = [];
      if (!this.form.valid) {
        errorMessage.push('Formulaire invalide');
      }
      if (this.selectedDepotIds().length === 0) {
        errorMessage.push('Sélectionner au moins un dépôt');
      }
      this.error.set(errorMessage.join(', '));
    }
  }

  onCancel(): void {
    this.close.emit();
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


  setImageInputType(type: 'file' | 'url'): void {
    this.imageInputType = type;
    if (type === 'file') {
      this.form.get('photoUrl')?.setValue('');
    } else {
      this.selectedFile = null;
    }
  }

  loadImageFromUrl(): void {
    const url = this.form.get('photoUrl')?.value;
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
    this.form.get('photoUrl')?.setValue('');
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
