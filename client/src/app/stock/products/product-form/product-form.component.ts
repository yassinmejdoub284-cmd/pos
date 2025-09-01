import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css'],
  standalone: false

})
export class ProductFormComponent implements OnInit {
  @Input() product: Product | null = null;
  @Output() saved = new EventEmitter<Product>();
  @Output() cancelled = new EventEmitter<void>();

  productForm: FormGroup;
  loading = false;
  error = '';
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  constructor(
    private fb: FormBuilder,
    private productsService: ProductsService
  ) {
    this.productForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      famille: ['Général', Validators.required],
      barcode: [''],
      unite: ['pcs', Validators.required],
      prix_vente_TTC: [0, [Validators.required, Validators.min(0)]],
      tva: [19, [Validators.required, Validators.min(0), Validators.max(100)]],
      duree_conservation: [null]
    });
  }

  ngOnInit(): void {
    if (this.product) {
      this.productForm.patchValue(this.product);
      if (this.product.photo) {
        this.imagePreview = this.product.photo;
      }
    }
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
        this.error = 'Erreur lors de la génération du code-barres';
      }
    });
  }

  onSubmit(): void {
    if (this.productForm.valid) {
      this.loading = true;
      this.error = '';

      const formData = this.productForm.value;

      const saveProduct = () => {
        if (this.product) {
          this.productsService.updateProduct(this.product.id, formData).subscribe({
            next: (product) => {
              this.loading = false;
              this.saved.emit(product);
            },
            error: (error) => {
              this.loading = false;
              this.error = 'Erreur lors de la mise à jour du produit';
            }
          });
        } else {
          this.productsService.createProduct(formData).subscribe({
            next: (product) => {
              this.loading = false;
              this.saved.emit(product);
            },
            error: (error) => {
              this.loading = false;
              this.error = 'Erreur lors de la création du produit';
            }
          });
        }
      };

      if (this.selectedFile) {
        this.productsService.uploadImage(this.selectedFile).subscribe({
          next: (response) => {
            formData.photo = response.imageUrl;
            saveProduct();
          },
          error: (error) => {
            this.loading = false;
            this.error = 'Erreur lors du téléchargement de l\'image';
          }
        });
      } else {
        saveProduct();
      }
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }
} 