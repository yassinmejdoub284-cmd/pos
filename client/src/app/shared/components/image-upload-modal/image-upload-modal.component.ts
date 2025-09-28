import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageCropperComponent } from '../image-cropper/image-cropper.component';

@Component({
  selector: 'app-image-upload-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageCropperComponent],
  template: `
    <div *ngIf="show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-semibold text-gray-800">Modifier l'image du produit</h3>
            <button (click)="close()" class="text-gray-500 hover:text-gray-800">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Upload Method Tabs -->
          <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button 
              (click)="setUploadMethod('file')"
              [class]="'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ' + 
                (uploadMethod === 'file' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800')">
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              Upload Fichier
            </button>
            <button 
              (click)="setUploadMethod('url')"
              [class]="'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ' + 
                (uploadMethod === 'url' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800')">
              <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
              </svg>
              URL Directe
            </button>
          </div>

          <!-- File Upload Method -->
          <div *ngIf="uploadMethod === 'file'">
            <div *ngIf="!selectedFile && !croppedImage" class="text-center py-8">
              <div class="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
              <p class="text-gray-600 mb-4">Cliquez pour sélectionner une image</p>
              <input 
                type="file" 
                #fileInput
                (change)="onFileSelected($event)"
                accept="image/*"
                class="hidden">
              <button 
                (click)="fileInput.click()"
                class="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all">
                Sélectionner une image
              </button>
            </div>

            <div *ngIf="selectedFile && !croppedImage" class="space-y-4">
              <div class="text-center">
                <p class="text-gray-700 mb-2">Image sélectionnée: {{ selectedFile.name }}</p>
                <app-image-cropper 
                  [imageSrc]="imagePreview || ''" 
                  (cropped)="onImageCropped($event)">
                </app-image-cropper>
              </div>
              
              <div class="flex justify-center space-x-4">
                <button 
                  (click)="resetSelection()"
                  class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all">
                  Annuler
                </button>
              </div>
            </div>

            <div *ngIf="croppedImage" class="space-y-4">
              <div class="text-center">
                <p class="text-gray-700 mb-2">Image recadrée</p>
                <img [src]="croppedImage" alt="Cropped" class="max-w-full max-h-64 mx-auto rounded-lg">
              </div>
              
              <div class="flex justify-center space-x-4">
                <button 
                  (click)="confirmUpload()"
                  class="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all">
                  Confirmer l'upload
                </button>
                <button 
                  (click)="resetSelection()"
                  class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all">
                  Annuler
                </button>
              </div>
            </div>
          </div>

          <!-- URL Input Method -->
          <div *ngIf="uploadMethod === 'url'">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">URL de l'image</label>
                <input 
                  type="url" 
                  [(ngModel)]="imageUrl"
                  (input)="onUrlInput()"
                  placeholder="https://example.com/image.jpg"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <p *ngIf="urlError" class="text-red-500 text-sm mt-1">{{ urlError }}</p>
              </div>

              <div *ngIf="imageUrl && !urlError" class="text-center">
                <p class="text-gray-700 mb-2">Aperçu de l'image</p>
                <img 
                  [src]="imageUrl" 
                  alt="Preview" 
                  class="max-w-full max-h-64 mx-auto rounded-lg border border-gray-200"
                  (error)="onImageError()"
                  (load)="onImageLoad()">
              </div>

              <div *ngIf="urlError" class="text-center py-8">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <p class="text-red-600">{{ urlError }}</p>
              </div>

              <div class="flex justify-center space-x-4">
                <button 
                  (click)="confirmUrlUpload()"
                  [disabled]="!imageUrl || !!urlError || urlLoading"
                  [class]="'px-4 py-2 rounded-lg transition-all ' + 
                    (imageUrl && !urlError && !urlLoading ? 
                      'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700' : 
                      'bg-gray-300 text-gray-500 cursor-not-allowed')">
                  <span *ngIf="urlLoading" class="flex items-center">
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Vérification...
                  </span>
                  <span *ngIf="!urlLoading">Confirmer l'URL</span>
                </button>
                <button 
                  (click)="resetSelection()"
                  class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ImageUploadModalComponent {
  @Input() show = false;
  @Input() currentImageUrl: string | null = null;
  @Output() uploadConfirmed = new EventEmitter<File | string>();
  @Output() closed = new EventEmitter<void>();

  selectedFile: File | null = null;
  imagePreview: string | null = null;
  croppedImage: string | null = null;
  uploadMethod: 'file' | 'url' = 'file';
  imageUrl: string = '';
  urlError: string = '';
  urlLoading: boolean = false;

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.selectedFile = file;
      this.createImagePreview(file);
    }
  }

  createImagePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreview = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  onImageCropped(croppedImageData: string): void {
    this.croppedImage = croppedImageData;
  }

  confirmUpload(): void {
    if (this.selectedFile && this.croppedImage) {
      // Create a new file from the cropped image
      this.dataURLtoFile(this.croppedImage, this.selectedFile.name).then(file => {
        this.uploadConfirmed.emit(file);
        this.close();
      });
    }
  }

  resetSelection(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.croppedImage = null;
    this.imageUrl = '';
    this.urlError = '';
    this.urlLoading = false;
  }

  close(): void {
    this.resetSelection();
    this.closed.emit();
  }

  setUploadMethod(method: 'file' | 'url'): void {
    this.uploadMethod = method;
    this.resetSelection();
  }

  onUrlInput(): void {
    this.urlError = '';
    this.urlLoading = false;
  }

  onImageError(): void {
    this.urlError = 'Impossible de charger l\'image. Vérifiez que l\'URL est correcte et accessible.';
    this.urlLoading = false;
  }

  onImageLoad(): void {
    this.urlError = '';
    this.urlLoading = false;
  }

  confirmUrlUpload(): void {
    if (this.imageUrl && !this.urlError) {
      this.uploadConfirmed.emit(this.imageUrl);
      this.close();
    }
  }

  private dataURLtoFile(dataURL: string, filename: string): Promise<File> {
    return new Promise((resolve, reject) => {
      try {
        // Extract the base64 data and mime type from the data URL
        const arr = dataURL.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        
        const blob = new Blob([u8arr], { type: mime });
        const file = new File([blob], filename, { type: mime });
        resolve(file);
      } catch (error) {
        reject(error);
      }
    });
  }
} 