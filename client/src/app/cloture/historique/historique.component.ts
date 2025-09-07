import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionsService, SessionCaisse, SessionFilters } from '../../core/services/sessions.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-historique',
  templateUrl: './historique.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class HistoriqueComponent implements OnInit {
  sessions = signal<SessionCaisse[]>([]);
  loading = signal(false);
  error = signal('');
  
  // Filters
  filters: SessionFilters = {
    startDate: '',
    endDate: '',
    userId: undefined,
    posId: undefined,
    status: undefined,
    hasVariance: undefined,
    page: 1,
    limit: 50
  };
  
  // Pagination
  currentPage = signal(1);
  totalPages = signal(1);
  totalSessions = signal(0);
  
  // UI state
  showFilters = signal(false);
  selectedSession = signal<SessionCaisse | null>(null);
  showSessionDetails = signal(false);
  
  // Computed values
  filteredSessions = computed(() => this.sessions());
  
  // Date range for quick filters
  quickFilters = {
    today: false,
    yesterday: false,
    thisWeek: false,
    thisMonth: false
  };

  constructor(
    public sessionsService: SessionsService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // First load without date filters to see if there are any sessions at all
    this.loadSessions();
    // Then set default date range
    this.setDefaultDateRange();
  }

  setDefaultDateRange(): void {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); // Start of current month
    
    this.filters.startDate = startOfMonth.toISOString().split('T')[0];
    this.filters.endDate = today.toISOString().split('T')[0];
  }

  loadSessions(): void {
    this.loading.set(true);
    this.error.set('');
    
    console.log('Loading sessions with filters:', this.filters);
    
    this.sessionsService.getSessions(this.filters).subscribe({
      next: (sessions) => {
        console.log('Sessions loaded:', sessions);
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading sessions:', error);
        this.error.set('Erreur lors du chargement des sessions: ' + (error.error?.error || error.message || 'Erreur inconnue'));
        this.loading.set(false);
      }
    });
  }

  applyFilters(): void {
    this.filters.page = 1;
    this.currentPage.set(1);
    this.loadSessions();
  }

  clearFilters(): void {
    this.filters = {
      startDate: '',
      endDate: '',
      userId: undefined,
      posId: undefined,
      status: undefined,
      hasVariance: undefined,
      page: 1,
      limit: 50
    };
    this.quickFilters = {
      today: false,
      yesterday: false,
      thisWeek: false,
      thisMonth: false
    };
    // Don't set default date range when clearing - show all sessions
    this.loadSessions();
  }

  applyQuickFilter(type: string): void {
    // Reset all quick filters
    this.quickFilters = {
      today: false,
      yesterday: false,
      thisWeek: false,
      thisMonth: false
    };
    
    const today = new Date();
    let startDate: Date;
    let endDate: Date = new Date(today);
    
    switch (type) {
      case 'today':
        startDate = new Date(today);
        this.quickFilters.today = true;
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        endDate = new Date(startDate);
        this.quickFilters.yesterday = true;
        break;
      case 'thisWeek':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay());
        this.quickFilters.thisWeek = true;
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        this.quickFilters.thisMonth = true;
        break;
      default:
        return;
    }
    
    this.filters.startDate = startDate.toISOString().split('T')[0];
    this.filters.endDate = endDate.toISOString().split('T')[0];
    this.applyFilters();
  }

  viewSessionDetails(session: SessionCaisse): void {
    this.selectedSession.set(session);
    this.showSessionDetails.set(true);
  }

  printSessionReport(session: SessionCaisse, type: 'X' | 'Z' = 'Z'): void {
    this.sessionsService.printReport(session.id, type).subscribe({
      next: (data) => {
        // TODO: Implement actual printing
        console.log(`${type} Report for session ${session.id}:`, data);
      },
      error: (error) => {
        this.error.set(`Erreur lors de l'impression du rapport ${type}`);
      }
    });
  }

  reopenSession(session: SessionCaisse): void {
    if (!this.authService.currentUser()?.role || !['ADMIN'].includes(this.authService.currentUser()?.role!)) {
      this.error.set('Seuls les administrateurs peuvent réouvrir une session');
      return;
    }
    
    const reason = prompt('Raison de la réouverture:');
    if (!reason) return;
    
    this.loading.set(true);
    this.sessionsService.reopenSession(session.id, reason).subscribe({
      next: () => {
        this.loadSessions();
        this.loading.set(false);
        this.error.set('');
      },
      error: (error) => {
        this.error.set(error.error?.error || 'Erreur lors de la réouverture de la session');
        this.loading.set(false);
      }
    });
  }

  exportToPDF(session: SessionCaisse): void {
    this.sessionsService.getSessionReport(session.id, 'Z', 'pdf').subscribe({
      next: (data) => {
        // TODO: Implement PDF download
        console.log('PDF export for session', session.id, data);
      },
      error: (error) => {
        this.error.set('Erreur lors de l\'export PDF');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/cloture']);
  }

  getSessionStatusLabel(status: string): string {
    return this.sessionsService.getSessionStatusLabel(status);
  }

  getSessionStatusClass(status: string): string {
    switch (status) {
      case 'OPEN':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-blue-100 text-blue-800';
      case 'REOPENED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getVarianceClass(variance: number | null | undefined): string {
    if (variance === null || variance === undefined) return 'text-gray-500';
    if (variance === 0) return 'text-green-600';
    if (Math.abs(variance) > 5) return 'text-red-600';
    return 'text-yellow-600';
  }

  formatCurrency(amount: number): string {
    return this.sessionsService.formatCurrency(amount);
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  formatDateTime(date: Date | string): string {
    return new Date(date).toLocaleString('fr-FR');
  }

  canReopenSession(session: SessionCaisse): boolean {
    const user = this.authService.currentUser();
    return user?.role === 'ADMIN' && session.status === 'CLOSED';
  }
}
