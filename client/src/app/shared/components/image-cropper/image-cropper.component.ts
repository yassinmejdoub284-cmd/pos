import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-cropper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="image-cropper-container">
      <div class="canvas-wrapper">
        <canvas #canvas 
          class="border border-gray-600 rounded-lg" 
          (mousedown)="onMouseDown($event)" 
          (mousemove)="onMouseMove($event)" 
          (mouseup)="onMouseUp($event)">
        </canvas>
      </div>
      
      <div class="mt-4 flex justify-center space-x-4">
        <button 
          (click)="crop()"
          class="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all">
          Recadrer
        </button>
        <button 
          (click)="reset()"
          class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all">
          Réinitialiser
        </button>
      </div>
    </div>
  `,
  styles: [`
    .image-cropper-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .canvas-wrapper {
      position: relative;
      display: inline-block;
    }
    
    canvas {
      cursor: crosshair;
      max-width: 100%;
      max-height: 400px;
      display: block;
    }
  `]
})
export class ImageCropperComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() imageSrc: string = '';
  @Output() cropped = new EventEmitter<string>();

  private _imageSrc: string = '';

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private image: HTMLImageElement = new Image();
  private isDragging = false;
  private isResizing = false;
  private resizeHandle: string = '';
  private startX = 0;
  private startY = 0;
  private cropX = 0;
  private cropY = 0;
  private cropWidth = 200;
  private cropHeight = 200;
  private originalCropWidth = 200;
  private originalCropHeight = 200;
  private scale = 1;
  private handleSize = 12;

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this._imageSrc = this.imageSrc;
    this.loadImage();
  }

  ngOnChanges(): void {
    if (this._imageSrc !== this.imageSrc && this.canvas) {
      this._imageSrc = this.imageSrc;
      this.loadImage();
    }
  }

  ngOnDestroy(): void {
    this.image.onload = null;
  }

  private loadImage(): void {
    if (!this.imageSrc) {
      console.warn('No image source provided');
      return;
    }

    this.image.onload = () => {
      console.log('Image loaded:', this.image.width, 'x', this.image.height);
      this.setupCanvas();
      this.draw();
    };

    this.image.onerror = (error) => {
      console.error('Error loading image:', error);
    };

    this.image.crossOrigin = 'anonymous';
    this.image.src = this.imageSrc;
  }



  private setupCanvas(): void {
    if (!this.image.complete || !this.image.naturalWidth) {
      console.warn('Image not fully loaded');
      return;
    }

    const maxWidth = 600;
    const maxHeight = 400;
    
    let { naturalWidth: width, naturalHeight: height } = this.image;
    
    console.log('Original image size:', width, 'x', height);
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
      this.scale = ratio;
    }
    
    console.log('Canvas size:', width, 'x', height, 'scale:', this.scale);
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Set initial crop area
    this.cropWidth = Math.min(200, width * 0.8);
    this.cropHeight = Math.min(200, height * 0.8);
    this.cropX = (width - this.cropWidth) / 2;
    this.cropY = (height - this.cropHeight) / 2;
  }

  private draw(): void {
    if (!this.image.complete || !this.canvas.width || !this.canvas.height) {
      console.warn('Cannot draw: image or canvas not ready');
      return;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw image
    this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
    
    // Draw overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Clear crop area
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillRect(this.cropX, this.cropY, this.cropWidth, this.cropHeight);
    this.ctx.globalCompositeOperation = 'source-over';
    
    // Draw crop border
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.cropX, this.cropY, this.cropWidth, this.cropHeight);
    
    // Draw corner handles
    this.drawHandle(this.cropX, this.cropY, 'top-left');
    this.drawHandle(this.cropX + this.cropWidth, this.cropY, 'top-right');
    this.drawHandle(this.cropX, this.cropY + this.cropHeight, 'bottom-left');
    this.drawHandle(this.cropX + this.cropWidth, this.cropY + this.cropHeight, 'bottom-right');
  }

  private drawHandle(x: number, y: number, position: string): void {
    const halfHandle = this.handleSize / 2;
    
    // Draw handle background
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(x - halfHandle, y - halfHandle, this.handleSize, this.handleSize);
    
    // Draw handle border
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - halfHandle, y - halfHandle, this.handleSize, this.handleSize);
    
    // Draw corner indicator
    this.ctx.fillStyle = '#000';
    const indicatorSize = 4;
    if (position.includes('top')) {
      this.ctx.fillRect(x - indicatorSize/2, y - halfHandle + 2, indicatorSize, indicatorSize);
    }
    if (position.includes('bottom')) {
      this.ctx.fillRect(x - indicatorSize/2, y + halfHandle - 6, indicatorSize, indicatorSize);
    }
    if (position.includes('left')) {
      this.ctx.fillRect(x - halfHandle + 2, y - indicatorSize/2, indicatorSize, indicatorSize);
    }
    if (position.includes('right')) {
      this.ctx.fillRect(x + halfHandle - 6, y - indicatorSize/2, indicatorSize, indicatorSize);
    }
  }

  onMouseDown(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if clicking on a resize handle
    const handle = this.getHandleAt(x, y);
    if (handle) {
      this.isResizing = true;
      this.resizeHandle = handle;
      this.originalCropWidth = this.cropWidth;
      this.originalCropHeight = this.cropHeight;
    } else if (this.isInsideCropArea(x, y)) {
      this.isDragging = true;
      this.startX = x - this.cropX;
      this.startY = y - this.cropY;
    }
  }

  onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Update cursor based on position
    this.updateCursor(x, y);
    
    if (!this.isDragging && !this.isResizing) return;
    
    if (this.isDragging) {
      this.cropX = Math.max(0, Math.min(this.canvas.width - this.cropWidth, x - this.startX));
      this.cropY = Math.max(0, Math.min(this.canvas.height - this.cropHeight, y - this.startY));
    } else if (this.isResizing) {
      this.handleResize(x, y);
    }
    
    this.draw();
  }

  private updateCursor(x: number, y: number): void {
    const handle = this.getHandleAt(x, y);
    if (handle) {
      this.canvas.style.cursor = 'nw-resize';
    } else if (this.isInsideCropArea(x, y)) {
      this.canvas.style.cursor = 'move';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  private handleResize(x: number, y: number): void {
    const minSize = 50;
    
    switch (this.resizeHandle) {
      case 'top-left':
        const newWidth1 = this.originalCropWidth + (this.cropX - x);
        const newHeight1 = this.originalCropHeight + (this.cropY - y);
        if (newWidth1 >= minSize && newHeight1 >= minSize) {
          this.cropWidth = newWidth1;
          this.cropHeight = newHeight1;
          this.cropX = x;
          this.cropY = y;
        }
        break;
        
      case 'top-right':
        const newWidth2 = x - this.cropX;
        const newHeight2 = this.originalCropHeight + (this.cropY - y);
        if (newWidth2 >= minSize && newHeight2 >= minSize) {
          this.cropWidth = newWidth2;
          this.cropHeight = newHeight2;
          this.cropY = y;
        }
        break;
        
      case 'bottom-left':
        const newWidth3 = this.originalCropWidth + (this.cropX - x);
        const newHeight3 = y - this.cropY;
        if (newWidth3 >= minSize && newHeight3 >= minSize) {
          this.cropWidth = newWidth3;
          this.cropHeight = newHeight3;
          this.cropX = x;
        }
        break;
        
      case 'bottom-right':
        const newWidth4 = x - this.cropX;
        const newHeight4 = y - this.cropY;
        if (newWidth4 >= minSize && newHeight4 >= minSize) {
          this.cropWidth = newWidth4;
          this.cropHeight = newHeight4;
        }
        break;
    }
    
    // Ensure crop area stays within canvas bounds
    this.cropX = Math.max(0, Math.min(this.canvas.width - this.cropWidth, this.cropX));
    this.cropY = Math.max(0, Math.min(this.canvas.height - this.cropHeight, this.cropY));
  }

  onMouseUp(event: MouseEvent): void {
    this.isDragging = false;
    this.isResizing = false;
  }

  private getHandleAt(x: number, y: number): string {
    const halfHandle = this.handleSize / 2;
    
    // Top-left
    if (x >= this.cropX - halfHandle && x <= this.cropX + halfHandle &&
        y >= this.cropY - halfHandle && y <= this.cropY + halfHandle) {
      return 'top-left';
    }
    
    // Top-right
    if (x >= this.cropX + this.cropWidth - halfHandle && x <= this.cropX + this.cropWidth + halfHandle &&
        y >= this.cropY - halfHandle && y <= this.cropY + halfHandle) {
      return 'top-right';
    }
    
    // Bottom-left
    if (x >= this.cropX - halfHandle && x <= this.cropX + halfHandle &&
        y >= this.cropY + this.cropHeight - halfHandle && y <= this.cropY + this.cropHeight + halfHandle) {
      return 'bottom-left';
    }
    
    // Bottom-right
    if (x >= this.cropX + this.cropWidth - halfHandle && x <= this.cropX + this.cropWidth + halfHandle &&
        y >= this.cropY + this.cropHeight - halfHandle && y <= this.cropY + this.cropHeight + halfHandle) {
      return 'bottom-right';
    }
    
    return '';
  }

  private isInsideCropArea(x: number, y: number): boolean {
    return x >= this.cropX && x <= this.cropX + this.cropWidth &&
           y >= this.cropY && y <= this.cropY + this.cropHeight;
  }

  crop(): void {
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d')!;
    
    croppedCanvas.width = this.cropWidth / this.scale;
    croppedCanvas.height = this.cropHeight / this.scale;
    
    croppedCtx.drawImage(
      this.image,
      this.cropX / this.scale,
      this.cropY / this.scale,
      this.cropWidth / this.scale,
      this.cropHeight / this.scale,
      0,
      0,
      croppedCanvas.width,
      croppedCanvas.height
    );
    
    const croppedImageData = croppedCanvas.toDataURL('image/jpeg', 0.9);
    this.cropped.emit(croppedImageData);
  }

  reset(): void {
    this.setupCanvas();
    this.draw();
  }
} 