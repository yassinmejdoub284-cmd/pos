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
      </div>
    </div>
  `
})
export class ImageUploadModalComponent {
  @Input() show = false;
  @Input() currentImageUrl: string | null = null;
  @Output() uploadConfirmed = new EventEmitter<File>();
  @Output() closed = new EventEmitter<void>();

  selectedFile: File | null = null;
  imagePreview: string | null = null;
  croppedImage: string | null = null;

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
  }

  close(): void {
    this.resetSelection();
    this.closed.emit();
  }

  private dataURLtoFile(dataURL: string, filename: string): Promise<File> {
    return fetch(dataURL)
      .then(res => res.blob())
      .then(blob => new File([blob], filename, { type: blob.type }));
  }
} 