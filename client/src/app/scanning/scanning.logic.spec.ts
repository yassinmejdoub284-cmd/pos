
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ScanningComponent } from './scanning.component';

// Mock everything manually
const mockProductsService = {
  getProducts: () => of([])
} as any;

const mockProduitsDeCaisseService = {
  getActiveProduitsDeCaisse: () => of([])
} as any;

const mockRouter = {
  navigate: vi.fn()
} as any;

const mockHttpClient = {
  get: vi.fn().mockReturnValue(of([])),
  post: vi.fn().mockReturnValue(of({}))
} as any;

const mockSettingsService = { getSettings: () => of({}) } as any;
const mockSessionsService = { currentSession: () => null, currentSession$: of(null) } as any;
const mockAuthService = { currentUser: () => ({ id: 1, depotId: 1 }) } as any;
const mockStockDocumentsService = { getNextDocumentNumber: () => of('DOC-001') } as any;

// Global objects
const Audio = vi.fn().mockImplementation(() => ({
    play: vi.fn().mockReturnValue(Promise.resolve()),
    pause: vi.fn(),
    currentTime: 0,
    volume: 1,
    src: ''
}));
(global as any).Audio = Audio;

// Mock document.getElementById
(global as any).document = {
    getElementById: vi.fn().mockReturnValue({ focus: vi.fn() }),
    querySelector: vi.fn().mockReturnValue({ 
        scrollIntoView: vi.fn(), 
        classList: { add: vi.fn(), remove: vi.fn() } 
    })
};

describe('ScanningComponent Logic (Isolated)', () => {
  let component: ScanningComponent;

  beforeEach(() => {
    // Manually instantiate
    // Constructor args: Router, HttpClient, ProductsService, ProduitsDeCaisseService, ClientsService, DepotsService, VehiclesService, DriversService, StockDocumentsService, SettingsService, SessionsService, AuthService, WholesaleRulesService
    // We pass minimal mocks or nulls for unused services if they are not used in parseAndAddBarcode
    component = new ScanningComponent(
      mockRouter,
      mockHttpClient,
      mockProductsService,
      mockProduitsDeCaisseService,
      {} as any, // ClientsService
      {} as any, // DepotsService
      {} as any, // VehiclesService
      {} as any, // DriversService
      mockStockDocumentsService,
      mockSettingsService,
      mockSessionsService,
      mockAuthService,
      {} as any // WholesaleRulesService
    );
    
    // Manually setup caches
    (component as any).productsCache = new Map();
    (component as any).productsCache.set(100, { id: 100, name: 'Stock Item A' });
    (component as any).productsCache.set(999, { id: 999, name: 'Parent Product Z' });

    (component as any).produitsDeCaisseCache = new Map();
    (component as any).produitsDeCaisseCache.set(200, { id: 200, name: 'Pos Item B', parentProductId: 999 });
    (component as any).produitsDeCaisseCache.set(300, { id: 300, name: 'Orphan Item', parentProductId: null });
    
    // Mock internal methods that touch DOM or weird APIs
    (component as any).playSuccessSound = vi.fn(); // Avoid Audio issues entirely
    (component as any).playErrorSound = vi.fn();
    (component as any).scrollToScannedItem = vi.fn(); // Avoid DOM issues
    (component as any).resetScanningState = vi.fn(); // Avoid focus issues
  });

  it('should resolve a direct STOCK PRODUCT scan', () => {
    const barcode = "2321100010000"; 
    (component as any).parseAndAddBarcode(barcode);

    expect(component.scannedItems.length).toBe(1);
    expect((component.scannedItems[0] as any).productId).toBe(100);
    expect(component.scannedItems[0].productName).toBe('Stock Item A');
  });

  it('should resolve a POS ITEM scan to its PARENT PRODUCT', () => {
    const barcode = "2321200020000"; 
    (component as any).parseAndAddBarcode(barcode);

    expect(component.scannedItems.length).toBe(1);
    expect((component.scannedItems[0] as any).productId).toBe(999);
    expect(component.scannedItems[0].productName).toContain('Parent Product Z');
  });

  it('should REJECT an Orphan POS Item', () => {
    const barcode = "2321300010000"; 
    (component as any).parseAndAddBarcode(barcode);

    expect(component.scannedItems.length).toBe(0);
    // expect(component.error).toBeDefined(); // scanning component sets error string
  });
});
