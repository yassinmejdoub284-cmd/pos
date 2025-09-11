import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Product } from '../models/product.model';

export interface DragState {
  isDragging: boolean;
  draggedProduct: Product | null;
  fromGlobalIndex: number;
  currentPage: number;
  targetGlobalIndex: number | null;
  dragPosition: { x: number; y: number } | null;
}

@Injectable({
  providedIn: 'root'
})
export class DragDropService {
  private dragState = new BehaviorSubject<DragState>({
    isDragging: false,
    draggedProduct: null,
    fromGlobalIndex: -1,
    currentPage: 0,
    targetGlobalIndex: null,
    dragPosition: null
  });

  private edgeHoverTimer: any = null;
  private autoPageTimer: any = null;
  private movementTimer: any = null;
  private initialPosition: { x: number; y: number } | null = null;
  private movementCheckEnabled: boolean = false;

  // Configuration
  private readonly EDGE_THRESHOLD = 0.15; // 15% of container width
  private readonly EDGE_HOVER_DELAY = 300; // 300ms to trigger pagination
  private readonly AUTO_PAGE_INTERVAL = 500; // 500ms between auto-pages
  private readonly MOVEMENT_THRESHOLD = 20; // 20px movement threshold to start drag
  private readonly MOVEMENT_DELAY = 300; // 300ms delay before checking for movement

  // Public observables
  public dragState$ = this.dragState.asObservable();
  public onPageChange = new Subject<{ direction: 'prev' | 'next'; currentPage: number }>();
  public onOrderChange = new Subject<{ fromIndex: number; toIndex: number; products: Product[] }>();

  // Start drag operation
  startDrag(product: Product, fromGlobalIndex: number, currentPage: number): void {
    console.log('Starting drag for:', product.name);
    
    this.dragState.next({
      isDragging: true,
      draggedProduct: product,
      fromGlobalIndex,
      currentPage,
      targetGlobalIndex: null,
      dragPosition: null
    });
  }

  // Update drag position
  updateDragPosition(x: number, y: number, containerRect: DOMRect, products: Product[], currentPage: number, itemsPerPage: number): void {
    const state = this.dragState.value;
    if (!state.isDragging) return;

    // Update drag position
    this.dragState.next({
      ...state,
      dragPosition: { x, y }
    });

    // Check for edge hover pagination
    this.checkEdgeHover(x, containerRect, currentPage);

    // Calculate target position
    const targetIndex = this.calculateTargetIndex(x, y, containerRect, products, currentPage, itemsPerPage);
    
    this.dragState.next({
      ...state,
      dragPosition: { x, y },
      targetGlobalIndex: targetIndex
    });
  }

  // Record initial touch/mouse position
  recordInitialPosition(product: Product, currentIndex: number, x: number, y: number): void {
    console.log('Recording initial position for:', product.name);
    
    // Record initial position for movement threshold
    this.initialPosition = { x, y };
    this.movementCheckEnabled = false;
    
    // Set the dragged product in state so we can detect when to start dragging
    this.dragState.next({
      ...this.dragState.value,
      draggedProduct: product,
      fromGlobalIndex: currentIndex
    });
  }

  // Start drag detection when movement is detected
  startDragDetection(): void {
    if (!this.initialPosition) return;
    
    console.log('Starting drag detection - movement detected');
    
    // Start movement timer - only check for movement after a delay
    this.movementTimer = setTimeout(() => {
      console.log('Movement checking enabled');
      this.movementCheckEnabled = true;
    }, this.MOVEMENT_DELAY);
  }

  // Cancel drag detection
  cancelDragDetection(): void {
    if (this.movementTimer) {
      clearTimeout(this.movementTimer);
      this.movementTimer = null;
    }
    
    // Clear initial position and movement flag
    this.initialPosition = null;
    this.movementCheckEnabled = false;
    
    // Clear the dragged product if we're not in drag mode
    const state = this.dragState.value;
    if (!state.isDragging) {
      this.dragState.next({
        ...state,
        draggedProduct: null,
        fromGlobalIndex: -1
      });
    }
  }

  // Drop the item
  drop(fromGlobalIndex: number, toGlobalIndex: number, products: Product[]): void {
    if (fromGlobalIndex === toGlobalIndex) {
      this.cancelDrag();
      return;
    }

    // Move item in array
    const newProducts = [...products];
    const [movedItem] = newProducts.splice(fromGlobalIndex, 1);
    newProducts.splice(toGlobalIndex, 0, movedItem);

    // Recompute displayIndex for all products
    const updatedProducts = newProducts.map((product, index) => ({
      ...product,
      displayIndex: index + 1
    }));

    // Emit order change
    this.onOrderChange.next({
      fromIndex: fromGlobalIndex,
      toIndex: toGlobalIndex,
      products: updatedProducts
    });

    this.cancelDrag();
  }

  // Move to specific index
  moveToIndex(product: Product, targetIndex: number, products: Product[]): void {
    const currentIndex = products.findIndex(p => p.id === product.id);
    if (currentIndex === -1) return;

    const fromGlobalIndex = currentIndex;
    const toGlobalIndex = Math.max(0, Math.min(targetIndex - 1, products.length - 1)); // Convert to 0-based

    this.drop(fromGlobalIndex, toGlobalIndex, products);
  }

  // Cancel drag operation
  cancelDrag(): void {
    console.log('Cancelling drag');
    
    this.dragState.next({
      isDragging: false,
      draggedProduct: null,
      fromGlobalIndex: -1,
      currentPage: 0,
      targetGlobalIndex: null,
      dragPosition: null
    });

    this.cancelDragDetection();
    this.clearEdgeHoverTimers();
  }

  // Get current drag state
  getCurrentDragState(): DragState {
    return this.dragState.value;
  }

  // Check if there's been any movement from initial position
  hasMovement(x: number, y: number): boolean {
    if (!this.initialPosition) return false;
    
    const deltaX = Math.abs(x - this.initialPosition.x);
    const deltaY = Math.abs(y - this.initialPosition.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    return distance > 0;
  }

  // Check if there's been significant movement from initial position
  hasSignificantMovement(x: number, y: number): boolean {
    if (!this.initialPosition) return false;
    
    // Don't check for movement until the movement timer has completed
    if (!this.movementCheckEnabled) return false;
    
    const deltaX = Math.abs(x - this.initialPosition.x);
    const deltaY = Math.abs(y - this.initialPosition.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    console.log(`Movement check: distance=${distance.toFixed(1)}px, threshold=${this.MOVEMENT_THRESHOLD}px`);
    
    return distance >= this.MOVEMENT_THRESHOLD;
  }

  // Check for edge hover pagination
  private checkEdgeHover(x: number, containerRect: DOMRect, currentPage: number): void {
    const containerWidth = containerRect.width;
    const relativeX = x - containerRect.left;
    const leftThreshold = containerWidth * this.EDGE_THRESHOLD;
    const rightThreshold = containerWidth * (1 - this.EDGE_THRESHOLD);

    if (relativeX < leftThreshold) {
      // Hovering left edge
      if (!this.edgeHoverTimer) {
        this.edgeHoverTimer = setTimeout(() => {
          if (currentPage > 0) {
            this.onPageChange.next({ direction: 'prev', currentPage });
            this.startAutoPage('prev', currentPage);
          }
        }, this.EDGE_HOVER_DELAY);
      }
    } else if (relativeX > rightThreshold) {
      // Hovering right edge
      if (!this.edgeHoverTimer) {
        this.edgeHoverTimer = setTimeout(() => {
          this.onPageChange.next({ direction: 'next', currentPage });
          this.startAutoPage('next', currentPage);
        }, this.EDGE_HOVER_DELAY);
      }
    } else {
      // Not hovering edge
      this.clearEdgeHoverTimers();
    }
  }

  // Start auto-pagination
  private startAutoPage(direction: 'prev' | 'next', currentPage: number): void {
    this.autoPageTimer = setInterval(() => {
      this.onPageChange.next({ direction, currentPage });
    }, this.AUTO_PAGE_INTERVAL);
  }

  // Clear edge hover timers
  private clearEdgeHoverTimers(): void {
    if (this.edgeHoverTimer) {
      clearTimeout(this.edgeHoverTimer);
      this.edgeHoverTimer = null;
    }
    if (this.autoPageTimer) {
      clearInterval(this.autoPageTimer);
      this.autoPageTimer = null;
    }
  }

  // Calculate target index based on position using dynamic dimensions
  private calculateTargetIndex(x: number, y: number, containerRect: DOMRect, products: Product[], currentPage: number, itemsPerPage: number): number | null {
    const relativeX = x - containerRect.left;
    const relativeY = y - containerRect.top;

    // Get dynamic dimensions based on screen size
    const { itemWidth, itemHeight, gap } = this.getFixedDimensions();
    
    // Calculate how many items fit per row based on container width
    const cols = Math.floor((containerRect.width + gap) / (itemWidth + gap));
    const rows = Math.ceil(itemsPerPage / cols);

    // Calculate grid position using fixed dimensions
    const col = Math.max(0, Math.floor(relativeX / (itemWidth + gap)));
    const row = Math.max(0, Math.floor(relativeY / (itemHeight + gap)));

    // Validate position - allow dropping at the edges
    if (col < 0 || col >= cols || row < 0 || row >= rows) {
      return null;
    }

    // Special case: if we're at the very first position, ensure we get index 0
    if (col === 0 && row === 0 && currentPage === 0) {
      return 0;
    }

    // Calculate local index on current page
    const localIndex = row * cols + col;
    
    // Calculate global index
    const globalIndex = currentPage * itemsPerPage + localIndex;
    
    // Validate global index
    if (globalIndex < 0 || globalIndex >= products.length) {
      return null;
    }

    return globalIndex;
  }

  // Get fixed dimensions - 97x127.6 for most screens, 88x127.6 for 1024x768
  private getFixedDimensions(): { itemWidth: number; itemHeight: number; gap: number } {
    // Check if we're on a 1024x768 screen
    if (window.innerWidth === 1024 && window.innerHeight === 768) {
      return { itemWidth: 88, itemHeight: 127.6, gap: 8 };
    }
    return { itemWidth: 97, itemHeight: 127.6, gap: 8 };
  }

  // Get number of columns based on container width (legacy method, kept for compatibility)
  private getColumnsCount(containerWidth: number): number {
    const { itemWidth, gap } = this.getFixedDimensions();
    return Math.floor((containerWidth + gap) / (itemWidth + gap));
  }
}