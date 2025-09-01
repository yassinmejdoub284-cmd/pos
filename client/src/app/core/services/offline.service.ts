import { Injectable, signal } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Product, StockMovement } from '../models/product.model';
import { Sale } from '../models/sale.model';

export interface OfflineQueue {
  id?: number;
  action: string;
  endpoint: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export class PosDatabase extends Dexie {
  products!: Table<Product>;
  sales!: Table<Sale>;
  stockMovements!: Table<StockMovement>;
  offlineQueue!: Table<OfflineQueue>;

  constructor() {
    super('PosDatabase');
    this.version(1).stores({
      products: '++id, name, category, sku',
      sales: '++id, createdAt, status',
      stockMovements: '++id, productId, type, date',
      offlineQueue: '++id, action, timestamp'
    });
  }
}

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private db: PosDatabase;
  public isOnline = signal(navigator.onLine);

  constructor() {
    this.db = new PosDatabase();
    this.setupOnlineOfflineListeners();
  }

  async saveProduct(product: Product): Promise<void> {
    await this.db.products.put(product);
  }

  async getProducts(): Promise<Product[]> {
    return await this.db.products.toArray();
  }

  async saveSale(sale: Sale): Promise<void> {
    await this.db.sales.put(sale);
  }

  async getSales(): Promise<Sale[]> {
    return await this.db.sales.toArray();
  }

  async saveStockMovement(movement: StockMovement): Promise<void> {
    await this.db.stockMovements.put(movement);
  }

  async getStockMovements(): Promise<StockMovement[]> {
    return await this.db.stockMovements.toArray();
  }

  async addToOfflineQueue(queueItem: Omit<OfflineQueue, 'id'>): Promise<void> {
    await this.db.offlineQueue.add({
      ...queueItem,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3
    });
  }

  async getOfflineQueue(): Promise<OfflineQueue[]> {
    return await this.db.offlineQueue.toArray();
  }

  async removeFromQueue(id: number): Promise<void> {
    await this.db.offlineQueue.delete(id);
  }

  async updateQueueRetry(id: number, retryCount: number): Promise<void> {
    await this.db.offlineQueue.update(id, { retryCount });
  }

  async clearDatabase(): Promise<void> {
    await this.db.delete();
    this.db = new PosDatabase();
  }

  private setupOnlineOfflineListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }

  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline()) return;

    const queue = await this.getOfflineQueue();
    
    for (const item of queue) {
      try {
        await this.processQueueItem(item);
        await this.removeFromQueue(item.id!);
      } catch (error) {
        if (item.retryCount < item.maxRetries) {
          await this.updateQueueRetry(item.id!, item.retryCount + 1);
        } else {
          await this.removeFromQueue(item.id!);
        }
      }
    }
  }

  private async processQueueItem(item: OfflineQueue): Promise<void> {
    const response = await fetch(item.endpoint, {
      method: item.action === 'POST' ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(item.data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
} 