import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DepotsService } from '../core/services/depots.service';
import { SessionsService, SessionCaisse, CashMovement } from '../core/services/sessions.service';
import { AuthService } from '../core/services/auth.service';
import { Depot } from '../core/models/depot.model';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface ProductData {
  id: number;
  name: string;
  quantity: number;
  revenue: number;
  discount: number;
  unitPrice?: number;
}

interface FamilyData {
  id: number;
  name: string;
  totalRevenue: number;
  totalDiscount: number;
  products: ProductData[];
}

interface SessionExtract {
  sessionId: number;
  date: string;
  totalRevenue: number;
  totalDiscount: number;
  totalExpenses: number;
  totalCancelled?: number;
  supplierPayments?: number;
  withdrawals?: number;
  totalCash?: number;
  cancelledTickets?: Array<{ id: number; ticketNumber: string; amount: number }>;
  families: FamilyData[];
  session?: SessionCaisse;
}

@Component({
  selector: 'app-extrait-par-article',
  templateUrl: './extrait-par-article.component.html',
  styleUrls: ['./extrait-par-article.component.css'],
  standalone: false
})
export class ExtraitParArticleComponent implements OnInit, OnDestroy {
  depotId: string | null = null;
  depot: Depot | null = null;
  sessions: SessionCaisse[] = [];
  extracts: SessionExtract[] = [];
  currentSessionIndex = 0;
  loading = false;
  error = '';
  selectedSessionId: number | null = null;
  showSessionDetail = false;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private depotsService: DepotsService,
    private sessionsService: SessionsService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Ensure auth state is loaded (auth guard already verified, just restore if needed)
    const token = this.authService.getToken();
    const userStr = sessionStorage.getItem('user');
    
    // Restore auth state if needed (but don't redirect - guard handles that)
    if (token && userStr && !this.authService.isAuthenticated()) {
      try {
        const user = JSON.parse(userStr);
        this.authService.currentUser.set(user);
        this.authService.isAuthenticated.set(true);
        console.log('Restored auth state in component');
      } catch (error) {
        console.error('Error parsing user data:', error);
        // Don't redirect here - let the guard handle it if auth is truly invalid
      }
    }

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.depotId = params.get('depotId');
      if (this.depotId) {
        console.log('Loading depot:', this.depotId);
        this.loadDepot();
      } else {
        // If no depotId is provided, redirect to home
        this.error = 'Aucun dépôt spécifié. Redirection...';
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 2000);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDepot(): void {
    if (!this.depotId) return;

    this.loading = true;
    this.error = '';

    this.depotsService.get(Number(this.depotId))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depot) => {
          this.depot = depot;
          this.loadSessions();
        },
        error: (err) => {
          this.error = 'Erreur lors du chargement du dépôt';
          this.loading = false;
          console.error('Error loading depot:', err);
        }
      });
  }

  loadSessions(): void {
    if (!this.depotId) return;

    // Check if user is authenticated using AuthService
    const isAuthenticated = this.authService.isAuthenticated();
    let token = this.authService.getToken();
    const currentUser = this.authService.currentUser();
    
    // If not authenticated or no token, try to restore from sessionStorage
    if (!isAuthenticated || !token) {
      const storedToken = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');
      
      if (storedToken && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          this.authService.currentUser.set(user);
          this.authService.isAuthenticated.set(true);
          token = storedToken;
          console.log('Restored auth state from sessionStorage');
        } catch (error) {
          console.error('Error parsing stored user data:', error);
        }
      }
    }
    
    // In development mode, use mock admin token if no token is available
    if (!token && !environment.production) {
      const mockAdminToken = 'mock-jwt-token-ADMIN-DEV-PERSISTENT';
      sessionStorage.setItem('token', mockAdminToken);
      // Set a mock user for the auth service
      const mockUser = {
        id: 1,
        username: 'admin',
        email: 'admin@patisserie.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN' as const,
        depotId: Number(this.depotId) || 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      sessionStorage.setItem('user', JSON.stringify(mockUser));
      sessionStorage.setItem('permissions', JSON.stringify({}));
      this.authService.isAuthenticated.set(true);
      this.authService.currentUser.set(mockUser);
      token = mockAdminToken;
      console.log('🔧 Development mode: Using mock admin token for article extracts access');
    }
    
    // Verify token exists before making request
    if (!token) {
      console.error('No token available for article extracts request');
      this.error = 'Session expirée: Veuillez vous reconnecter.';
      this.loading = false;
      // Redirect to login after a delay
      setTimeout(() => {
        this.router.navigate(['/auth/login']);
      }, 2000);
      return;
    }

    // Ensure token is in sessionStorage for interceptor
    if (token && !sessionStorage.getItem('token')) {
      sessionStorage.setItem('token', token);
    }

    console.log('Making request to article-extracts with token:', token.substring(0, 20) + '...');
    console.log('Current user:', currentUser);
    console.log('Is authenticated:', this.authService.isAuthenticated());
    this.loading = true;
    this.error = '';
    
    // Use the new article-extracts endpoint
    const depotIdNum = Number(this.depotId);

    // Store the original visitingDepotId to restore it later
    const originalVisitingDepotId = sessionStorage.getItem('visitingDepotId');
    
    // Set the visitingDepotId in sessionStorage so the interceptor adds the correct header
    sessionStorage.setItem('visitingDepotId', depotIdNum.toString());
    console.log('Set visitingDepotId to:', depotIdNum);
    
    // Verify token is available before making request
    const finalToken = sessionStorage.getItem('token') || this.authService.getToken();
    if (!finalToken) {
      console.error('No token available even after all checks');
      this.error = 'Session expirée: Veuillez vous reconnecter.';
      this.loading = false;
      setTimeout(() => {
        this.router.navigate(['/auth/login']);
      }, 2000);
      return;
    }
    
    console.log('Loading sessions for depot:', depotIdNum);
    console.log('Visiting depot ID in sessionStorage:', sessionStorage.getItem('visitingDepotId'));

    // First, get all sessions for this depot
    this.sessionsService.getSessions({ 
      depotId: depotIdNum,
      limit: 100 
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          // Keep visitingDepotId set until all reports are loaded
          // Don't restore it here - we'll restore it after all reports are loaded

          if (!sessions || sessions.length === 0) {
            // Restore original visitingDepotId before returning
            if (originalVisitingDepotId) {
              sessionStorage.setItem('visitingDepotId', originalVisitingDepotId);
            } else {
              sessionStorage.removeItem('visitingDepotId');
            }
            this.loading = false;
            this.error = 'Aucune session trouvée pour ce dépôt';
            return;
          }

          // Sort sessions by date descending (most recent first)
          const sortedSessions = sessions.slice().sort((a, b) => {
            const dateA = a.closedAt || a.openedAt;
            const dateB = b.closedAt || b.openedAt;
            const timeA = dateA instanceof Date ? dateA.getTime() : new Date(dateA).getTime();
            const timeB = dateB instanceof Date ? dateB.getTime() : new Date(dateB).getTime();
            return timeB - timeA;
          });

          // Get session reports for all sessions in parallel
          // Keep visitingDepotId set so the interceptor uses the correct depot
          const reportRequests = sortedSessions.map(session => 
            this.sessionsService.getSessionReport(session.id, 'Z', 'html', depotIdNum)
              .pipe(
                map(report => ({ session, report })),
                catchError(err => {
                  console.error(`Error loading report for session ${session.id}:`, err);
                  return of({ session, report: null });
                })
              )
          );

          forkJoin(reportRequests)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (sessionReports) => {
                // Restore original visitingDepotId after all reports are loaded
                if (originalVisitingDepotId) {
                  sessionStorage.setItem('visitingDepotId', originalVisitingDepotId);
                } else {
                  sessionStorage.removeItem('visitingDepotId');
                }
                // Process each session report and convert to SessionExtract format
                this.extracts = sessionReports
                  .filter(({ report }) => report !== null)
                  .map(({ session, report }) => {
                    const sessionReport = report as any;
                    const sessionData = sessionReport.session;
                    const summary = sessionReport.summary || {};
                    
                    // Build article grouping from session sales (same as print service)
                    const sales: any[] = (sessionData?.sales || []) as any[];
                    const familyArticleTotals: Record<string, Record<string, { quantity: number; total: number; discount: number }>> = {};
                    const cancelledSales: any[] = [];

                    // Separate completed, cancelled, and gift sales
                    sales.forEach(sale => {
                      const saleStatus = (sale.status || '').toUpperCase();
                      const notes = (sale.notes || '').toString();
                      const isGift = saleStatus === 'CADEAU' || saleStatus === 'PENDING_ADMIN' || notes.startsWith('Cadeau -');
                      
                      // Exclude gift tickets (CADEAU) - they should not be counted
                      if (isGift) {
                        return; // Skip gift tickets completely
                      }
                      
                      if (saleStatus === 'CANCELLED' || saleStatus === 'REFUNDED') {
                        cancelledSales.push(sale);
                      } else {
                        const items: any[] = (sale.items || []) as any[];
                        items.forEach(it => {
                          const productName: string = (it.productName || it.product?.name || 'Produit').toString();
                          const familyName: string = (it.product?.famille?.name || it.product?.family?.name || it.familyName || 'Sans famille').toString();
                          const qty: number = parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0;
                          const lineTotal: number = parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0;
                          const lineDiscount: number = parseFloat(String(it.discount ?? 0)) || 0;
                          
                          // Initialize family if not exists
                          if (!familyArticleTotals[familyName]) {
                            familyArticleTotals[familyName] = {};
                          }
                          
                          // Initialize article if not exists
                          if (!familyArticleTotals[familyName][productName]) {
                            familyArticleTotals[familyName][productName] = { quantity: 0, total: 0, discount: 0 };
                          }
                          
                          familyArticleTotals[familyName][productName].quantity += qty;
                          familyArticleTotals[familyName][productName].total += lineTotal;
                          familyArticleTotals[familyName][productName].discount += lineDiscount;
                        });
                      }
                    });

                    // Convert to families array format
                    const families: FamilyData[] = Object.keys(familyArticleTotals)
                      .sort()
                      .map(familyName => {
                        const products: ProductData[] = Object.keys(familyArticleTotals[familyName])
                          .map(productName => {
                            const productData = familyArticleTotals[familyName][productName];
                            return {
                              id: 0, // Will be set if available
                              name: productName,
                              quantity: productData.quantity,
                              revenue: productData.total,
                              discount: productData.discount,
                              unitPrice: productData.quantity > 0 ? productData.total / productData.quantity : 0
                            };
                          });
                        
                        const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
                        const totalDiscount = products.reduce((sum, p) => sum + p.discount, 0);
                        
                        return {
                          id: 0, // Will be set if available
                          name: familyName,
                          totalRevenue,
                          totalDiscount,
                          products
                        };
                      });

                    // Calculate totals from actual sales (same as print service)
                    // Exclude cancelled, refunded, and gift tickets (CADEAU)
                    const completedSales = sales.filter(s => {
                      const st = (s.status || '').toUpperCase();
                      const notes = (s.notes || '').toString();
                      const isGift = st === 'CADEAU' || st === 'PENDING_ADMIN' || notes.startsWith('Cadeau -');
                      return st !== 'CANCELLED' && st !== 'REFUNDED' && !isGift;
                    });
                    
                    const totalRevenue = completedSales.reduce((sum, s) => sum + parseFloat(s.finalTotal || 0), 0);
                    const totalDiscount = completedSales.reduce((sum, s) => sum + parseFloat(s.discount || 0), 0);
                    
                    const totalCancelled = cancelledSales.reduce((sum, s) => sum + parseFloat(s.finalTotal || 0), 0);

                    // Calculate expenses, supplier payments, and withdrawals from cash movements
                    const cashMovements: CashMovement[] = (sessionData.cashMovements || []) as CashMovement[];
                    const totalExpenses = cashMovements
                      .filter((m: CashMovement) => {
                        const reason = String(m.reason || '');
                        return (m.type === 'SORTIE' || m.type === 'DEPOT_COFFRE') && 
                               !reason.includes('Remboursement') && 
                               !reason.includes('[REJETÉ]') &&
                               !reason.includes('[SUPPRIMÉ]') &&
                               !reason.includes('Fournisseur') &&
                               !reason.includes('fournisseur');
                      })
                      .reduce((sum: number, m: CashMovement) => sum + parseFloat(String(m.amount || 0)), 0);

                    const supplierPayments = cashMovements
                      .filter((m: CashMovement) => {
                        const reason = String(m.reason || '');
                        return m.type === 'SORTIE' && 
                               (reason.includes('Fournisseur') || reason.includes('fournisseur')) &&
                               !reason.includes('[REJETÉ]') &&
                               !reason.includes('[SUPPRIMÉ]');
                      })
                      .reduce((sum: number, m: CashMovement) => sum + parseFloat(String(m.amount || 0)), 0);

                    const withdrawals = cashMovements
                      .filter((m: CashMovement) => {
                        const reason = String(m.reason || '');
                        return m.type === 'RETRAIT_CENTRALE' &&
                               !reason.includes('[REJETÉ]') &&
                               !reason.includes('[SUPPRIMÉ]');
                      })
                      .reduce((sum: number, m: CashMovement) => sum + parseFloat(String(m.amount || 0)), 0);

                    const totalCash = totalRevenue - totalDiscount - totalExpenses - supplierPayments - withdrawals;

                    // Format cancelled tickets
                    const cancelledTickets = cancelledSales.map(s => ({
                      id: s.id,
                      ticketNumber: s.ticketNumber || s.dailyTicketNumber || `#${s.id}`,
                      amount: parseFloat(s.finalTotal || 0)
                    }));

                    // Get date - handle both Date objects and strings
                    const sessionDate = session.closedAt || session.openedAt;
                    const dateStr = sessionDate instanceof Date 
                      ? sessionDate.toISOString().split('T')[0]
                      : new Date(sessionDate).toISOString().split('T')[0];

                    return {
                      sessionId: session.id,
                      date: dateStr,
                      totalRevenue,
                      totalDiscount,
                      totalExpenses,
                      totalCancelled,
                      supplierPayments,
                      withdrawals,
                      totalCash,
                      cancelledTickets,
                      families,
                      session: {
                        ...session,
                        user: sessionData.user,
                        depot: sessionData.depot,
                        cashMovements: sessionData.cashMovements
                      }
                    };
                  });

                // Sort extracts by date descending (most recent first)
                this.extracts.sort((a, b) => {
                  const dateA = new Date(a.date).getTime();
                  const dateB = new Date(b.date).getTime();
                  return dateB - dateA;
                });

                // Extract sessions from extracts
                this.sessions = this.extracts
                  .map(e => e.session)
                  .filter((s): s is SessionCaisse => s !== undefined && s !== null);

                // Set first session as selected
                if (this.extracts.length > 0) {
                  this.currentSessionIndex = 0;
                  this.selectedSessionId = this.extracts[0]?.sessionId || null;
                }

                this.loading = false;
              },
              error: (err) => {
                // Restore original visitingDepotId on error
                if (originalVisitingDepotId) {
                  sessionStorage.setItem('visitingDepotId', originalVisitingDepotId);
                } else {
                  sessionStorage.removeItem('visitingDepotId');
                }
                console.error('Error loading session reports:', err);
                this.error = 'Erreur lors du chargement des rapports de session';
                this.loading = false;
              }
            });
        },
        error: (err) => {
          // Restore original visitingDepotId on error
          if (originalVisitingDepotId) {
            sessionStorage.setItem('visitingDepotId', originalVisitingDepotId);
          } else {
            sessionStorage.removeItem('visitingDepotId');
          }

          console.error('Error loading sessions:', err);
          console.error('Error details:', {
            status: err.status,
            statusText: err.statusText,
            message: err.error?.error || err.message,
            url: err.url
          });
          
          if (err.status === 401) {
            // 401 means unauthorized - token is invalid or expired
            const errorMessage = err.error?.error || 'Token invalide ou expiré';
            const token = this.authService.getToken() || sessionStorage.getItem('token');
            
            if (!token) {
              // No token - session expired, redirect to login
              this.error = 'Session expirée: Veuillez vous reconnecter pour accéder aux extraits.';
            } else {
              // Token exists but got 401 - token is invalid or expired
              if (errorMessage.includes('expired') || errorMessage.includes('expiré')) {
                this.error = 'Session expirée: Votre session a expiré. Veuillez vous reconnecter.';
              } else if (errorMessage.includes('not found') || errorMessage.includes('inactive')) {
                this.error = 'Compte invalide: Votre compte n\'est plus actif. Veuillez contacter l\'administrateur.';
              } else {
                this.error = `Erreur d'authentification: ${errorMessage}. Veuillez vous reconnecter.`;
              }
            }
            // Always redirect to login on 401
            setTimeout(() => {
              this.authService.logout();
              this.router.navigate(['/auth/login']);
            }, 2000);
          } else if (err.status === 403) {
            this.error = 'Accès refusé: Vous n\'avez pas les permissions pour accéder aux extraits de ce dépôt. Assurez-vous d\'être connecté en tant qu\'ADMIN ou MANAGER.';
          } else {
            this.error = 'Erreur lors du chargement des sessions. Vérifiez que vous avez les permissions pour accéder à ce dépôt.';
          }
          this.loading = false;
        }
      });
  }

  getCurrentExtract(): SessionExtract | null {
    return this.extracts[this.currentSessionIndex] || null;
  }

  getCurrentSession(): SessionCaisse | null {
    return this.sessions[this.currentSessionIndex] || null;
  }

  selectSession(sessionId: number): void {
    const index = this.extracts.findIndex(e => e.sessionId === sessionId);
    if (index !== -1) {
      this.currentSessionIndex = index;
      this.selectedSessionId = sessionId;
      this.showSessionDetail = true;
      // Scroll to top of detail view
      setTimeout(() => {
        const detailElement = document.getElementById('session-detail');
        if (detailElement) {
          detailElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  previousSession(): void {
    if (this.currentSessionIndex > 0) {
      this.currentSessionIndex--;
      this.selectedSessionId = this.extracts[this.currentSessionIndex]?.sessionId || null;
      this.showSessionDetail = true;
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextSession(): void {
    if (this.currentSessionIndex < this.extracts.length - 1) {
      this.currentSessionIndex++;
      this.selectedSessionId = this.extracts[this.currentSessionIndex]?.sessionId || null;
      this.showSessionDetail = true;
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  canGoPrevious(): boolean {
    return this.currentSessionIndex > 0;
  }

  canGoNext(): boolean {
    return this.currentSessionIndex < this.extracts.length - 1;
  }

  goToSessionList(): void {
    this.showSessionDetail = false;
    setTimeout(() => {
      const listElement = document.getElementById('sessions-list');
      if (listElement) {
        listElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  getUserName(): string {
    const session = this.getCurrentSession();
    if (session?.user) {
      return `${session.user.firstName} ${session.user.lastName}`.trim();
    }
    return '';
  }

  formatCurrency(amount: number): string {
    return amount.toFixed(3) + ' TND';
  }

  formatTicketNumber(ticketNumber: string | number | undefined | null): string {
    if (ticketNumber === undefined || ticketNumber === null) return '';
    // Convert to string to handle both string and number types
    const ticketStr = String(ticketNumber);
    // If it already starts with #, return as is, otherwise add #
    return ticketStr.startsWith('#') ? ticketStr : `#${ticketStr}`;
  }

  formatQuantity(quantity: number): string {
    const formatted = quantity.toFixed(3);
    // If decimal part is .000, return only integer part
    if (formatted.endsWith('.000')) {
      return Math.floor(quantity).toString();
    }
    return formatted;
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
