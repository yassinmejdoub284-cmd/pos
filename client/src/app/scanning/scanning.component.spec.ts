
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { ScanningComponent } from './scanning.component';
import { ProductsService } from '../core/services/products.service';
import { ProduitsDeCaisseService } from '../core/services/produits-de-caisse.service';
import { ClientsService } from '../core/services/clients.service';
import { DepotsService } from '../core/services/depots.service';
import { VehiclesService } from '../core/services/vehicles.service';
import { DriversService } from '../core/services/drivers.service';
import { StockDocumentsService } from '../core/services/stock-documents.service';
import { SettingsService } from '../core/services/settings.service';
import { SessionsService } from '../core/services/sessions.service';
import { AuthService } from '../core/services/auth.service';
import { WholesaleRulesService } from '../core/services/wholesale-rules.service';
import { Router } from '@angular/router';

// Mock Services
class MockProductsService {
  getProducts() { return of([]); }
}
class MockProduitsDeCaisseService {
  getActiveProduitsDeCaisse() { return of([]); }
}
class MockClientsService {
  getClients() { return of({ clients: [] }); }
}
class MockDepotsService {
  list() { return of([]); }
}
class MockVehiclesService { 
  getActiveVehicles() { return of([]); }
}
class MockDriversService {
  getActiveDrivers() { return of([]); }
}
class MockStockDocumentsService {
  getNextDocumentNumber() { return of('DOC-001'); }
}
class MockSettingsService {
  getSettings() { return of({}); }
}
class MockSessionsService {
  currentSession() { return null; }
  currentSession$ = of(null);
}
class MockAuthService {
  currentUser() { return { id: 1, depotId: 1 }; }
}
class MockWholesaleRulesService {
  getRules() { return of([]); }
}
class MockRouter {
  navigate() {}
}

const Audio = vi.fn().mockImplementation(() => ({
    play: vi.fn().mockReturnValue(Promise.resolve()),
    pause: vi.fn(),
    currentTime: 0,
    volume: 1,
    src: ''
}));
(global as any).Audio = Audio;

describe('ScanningComponent ID Resolution', () => {
  let component: ScanningComponent;
  let fixture: ComponentFixture<ScanningComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScanningComponent ],
      imports: [ FormsModule ],
      schemas: [ NO_ERRORS_SCHEMA ],
      providers: [
        { provide: ProductsService, useClass: MockProductsService },
        { provide: ProduitsDeCaisseService, useClass: MockProduitsDeCaisseService },
        { provide: ClientsService, useClass: MockClientsService },
        { provide: DepotsService, useClass: MockDepotsService },
        { provide: VehiclesService, useClass: MockVehiclesService },
        { provide: DriversService, useClass: MockDriversService },
        { provide: StockDocumentsService, useClass: MockStockDocumentsService },
        { provide: SettingsService, useClass: MockSettingsService },
        { provide: SessionsService, useClass: MockSessionsService },
        { provide: AuthService, useClass: MockAuthService },
        { provide: WholesaleRulesService, useClass: MockWholesaleRulesService },
        { provide: Router, useClass: MockRouter },
        { 
          provide: HttpClient, 
          useValue: { 
            get: vi.fn().mockReturnValue(of([])),
            post: vi.fn().mockReturnValue(of({}))
          } 
        }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScanningComponent);
    component = fixture.componentInstance;
    
    // Disable ngOnInit to avoid heavy lifting and async chaos
    component.ngOnInit = () => {};

    // Manually initialize caches for testing
    // Stock Product: ID 100, Name "Stock Item A"
    (component as any).productsCache = new Map();
    (component as any).productsCache.set(100, { id: 100, name: 'Stock Item A' });
    (component as any).productsCache.set(999, { id: 999, name: 'Parent Product Z' }); // Parent for POS item

    // POS Item: ID 200, Name "Pos Item B", Parent 999
    (component as any).produitsDeCaisseCache = new Map();
    (component as any).produitsDeCaisseCache.set(200, { id: 200, name: 'Pos Item B', parentProductId: 999 });
    
    // Valid but Orphan POS Item: ID 300, Name "Orphan Item"
    (component as any).produitsDeCaisseCache.set(300, { id: 300, name: 'Orphan Item', parentProductId: null });

    fixture.detectChanges();
  });

  it('should resolve a direct STOCK PRODUCT scan', () => {
    // Barcode for ID 100
    const barcode = "2321100010000"; 
    
    (component as any).parseAndAddBarcode(barcode);

    expect(component.scannedItems.length).toBe(1);
    const item = component.scannedItems[0] as any;
    expect(item.productId).toBe(100);
    expect(item.productName).toBe('Stock Item A');
    expect(item.quantity).toBe(1000);
  });

  it('should resolve a POS ITEM scan to its PARENT PRODUCT', () => {
    // Barcode for ID 200
    const barcode = "2321200020000";
    
    (component as any).parseAndAddBarcode(barcode);

    expect(component.scannedItems.length).toBe(1);
    const item = component.scannedItems[0] as any;
    expect(item.productId).toBe(999);
    expect(item.productName).toContain('Parent Product Z');
    expect(item.quantity).toBe(2000);
  });

  it('should REJECT an Orphan POS Item that has no parent', () => {
    // Barcode for ID 300
    const barcode = "2321300010000";
    
    (component as any).parseAndAddBarcode(barcode);

    expect(component.scannedItems.length).toBe(0);
    expect(component.error).toContain('n\'est pas lié à un produit de stock');
  });

  it('should REJECT an unknown ID', () => {
    // Barcode for ID 500
    const barcode = "2321500010000";
    
    (component as any).parseAndAddBarcode(barcode);

    expect(component.scannedItems.length).toBe(0);
    expect(component.error).toContain('Produit 500 introuvable');
  });
});
