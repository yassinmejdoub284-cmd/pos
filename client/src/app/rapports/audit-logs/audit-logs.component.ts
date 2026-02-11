import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuditLogsService, AuditLog, AuditLogDetail, DailyStats } from './audit-logs.service';
import { AuditTranslatorService } from './audit-translator.service';

interface FilterState {
    startDate: string;
    endDate: string;
    userId: number | null;
    tableName: string;
    action: string;
    search: string;
    page: number;
    limit: number;
}

@Component({
    selector: 'app-audit-logs',
    templateUrl: './audit-logs.component.html',
    standalone: false
})
export class AuditLogsComponent implements OnInit, OnDestroy {
    logs: AuditLog[] = [];
    dailyStats: DailyStats | null = null;
    users: any[] = [];

    // États de chargement
    loading = false;
    loadingStats = false;
    loadingDetails = false;

    // Pagination
    currentPage = 1;
    totalPages = 1;
    totalCount = 0;
    hasNextPage = false;
    hasPrevPage = false;

    // Filtres
    filters: FilterState = {
        startDate: '',
        endDate: '',
        userId: null,
        tableName: 'all',
        action: 'all',
        search: '',
        page: 1,
        limit: 20
    };

    // Périodes prédéfinies
    predefinedPeriods = [
        { label: 'Aujourd\'hui', value: 'today' },
        { label: 'Cette semaine', value: 'week' },
        { label: 'Ce mois', value: 'month' },
        { label: 'Personnalisé', value: 'custom' }
    ];
    selectedPeriod = 'today';

    // Types de tables - Afficher tout par défaut
    tableTypes = [
        { label: 'Tout', value: 'all' }
    ];

    // Types d'actions
    actionTypes = [
        { label: 'Toutes', value: 'all' },
        { label: 'Créations', value: 'CREATE' },
        { label: 'Modifications', value: 'UPDATE' },
        { label: 'Suppressions', value: 'DELETE' }
    ];

    // Modal de détails
    showDetailsModal = false;
    selectedLog: AuditLogDetail | null = null;

    // Erreur
    errorMessage = '';

    // Subject pour la recherche avec debounce
    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();

    // Détection mobile
    isMobile = false;

    constructor(
        private auditService: AuditLogsService,
        public translator: AuditTranslatorService,
        private router: Router
    ) {
        this.isMobile = window.innerWidth < 768;
    }

    ngOnInit(): void {
        // Charger les utilisateurs pour le cache et le filtre
        this.loadUsers();

        // Charger les statistiques du jour
        this.loadDailyStats();

        // Appliquer la période par défaut (aujourd'hui)
        this.applyPredefinedPeriod('today');

        // Charger les logs
        this.loadLogs();

        // Charger les filtres sauvegardés
        this.loadSavedFilters();

        // Setup debounce pour la recherche
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            takeUntil(this.destroy$)
        ).subscribe(searchTerm => {
            this.filters.search = searchTerm;
            this.filters.page = 1;
            this.loadLogs();
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Charge les utilisateurs pour le cache et le filtre
     */
    async loadUsers(): Promise<void> {
        try {
            const usersMap = await this.auditService.getUsersForCache();
            this.users = Array.from(usersMap.values()).sort((a, b) =>
                a.firstName.localeCompare(b.firstName)
            );
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    /**
     * Charge les statistiques du jour
     */
    loadDailyStats(): void {
        this.loadingStats = true;
        this.auditService.getDailyStats().subscribe({
            next: (stats) => {
                this.dailyStats = stats;
                this.loadingStats = false;
            },
            error: (error) => {
                console.error('Error loading daily stats:', error);
                this.loadingStats = false;
            }
        });
    }

    /**
     * Charge les logs d'audit
     */
    loadLogs(): void {
        this.loading = true;
        this.errorMessage = '';

        const apiFilters: any = {
            page: this.filters.page,
            limit: this.filters.limit
        };

        if (this.filters.startDate) apiFilters.startDate = this.filters.startDate;
        if (this.filters.endDate) apiFilters.endDate = this.filters.endDate;
        if (this.filters.userId) apiFilters.userId = this.filters.userId;
        if (this.filters.tableName && this.filters.tableName !== 'all') {
            apiFilters.tableName = this.filters.tableName;
        }
        if (this.filters.action && this.filters.action !== 'all') {
            apiFilters.action = this.filters.action;
        }
        if (this.filters.search) apiFilters.search = this.filters.search;

        this.auditService.getAuditLogs(apiFilters).subscribe({
            next: (response) => {
                this.logs = response.data;
                this.currentPage = response.pagination.currentPage;
                this.totalPages = response.pagination.totalPages;
                this.totalCount = response.pagination.totalCount;
                this.hasNextPage = response.pagination.hasNextPage;
                this.hasPrevPage = response.pagination.hasPrevPage;
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = error.message;
                this.loading = false;
                this.handleError(error);
            }
        });
    }

    /**
     * Applique une période prédéfinie
     */
    applyPredefinedPeriod(period: string): void {
        this.selectedPeriod = period;
        const today = new Date();

        switch (period) {
            case 'today':
                this.filters.startDate = this.formatDate(today);
                this.filters.endDate = this.formatDate(today);
                break;

            case 'week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - 7);
                this.filters.startDate = this.formatDate(weekStart);
                this.filters.endDate = this.formatDate(today);
                break;

            case 'month':
                const monthStart = new Date(today);
                monthStart.setDate(1);
                this.filters.startDate = this.formatDate(monthStart);
                this.filters.endDate = this.formatDate(today);
                break;

            case 'custom':
                // Ne rien faire, l'utilisateur va sélectionner manuellement
                return;
        }

        this.filters.page = 1;
        this.loadLogs();
    }

    /**
     * Formate une date en YYYY-MM-DD
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Valide la plage de dates
     */
    validateDateRange(): boolean {
        if (this.filters.startDate && this.filters.endDate) {
            const start = new Date(this.filters.startDate);
            const end = new Date(this.filters.endDate);

            if (end < start) {
                this.errorMessage = 'La date de fin doit être après la date de début';
                return false;
            }
        }

        this.errorMessage = '';
        return true;
    }

    /**
     * Applique les filtres
     */
    applyFilters(): void {
        if (!this.validateDateRange()) {
            return;
        }

        this.filters.page = 1;
        this.loadLogs();
        this.saveFilters();
    }

    /**
     * Réinitialise les filtres
     */
    resetFilters(): void {
        this.filters = {
            startDate: '',
            endDate: '',
            userId: null,
            tableName: 'all',
            action: 'all',
            search: '',
            page: 1,
            limit: 20
        };
        this.selectedPeriod = 'today';
        this.applyPredefinedPeriod('today');
        localStorage.removeItem('audit-filters-favorite');
    }

    /**
     * Recherche avec debounce
     */
    onSearchChange(searchTerm: string): void {
        this.searchSubject.next(searchTerm);
    }

    /**
     * Change de page
     */
    goToPage(page: number): void {
        if (page < 1 || page > this.totalPages) return;
        this.filters.page = page;
        this.loadLogs();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Ouvre le modal de détails
     */
    openDetailsModal(log: AuditLog): void {
        this.loadingDetails = true;
        this.showDetailsModal = true;

        this.auditService.getAuditLogDetails(log.id).subscribe({
            next: (details) => {
                this.selectedLog = details;
                this.loadingDetails = false;
            },
            error: (error) => {
                console.error('Error loading log details:', error);
                this.loadingDetails = false;
                this.closeDetailsModal();
                this.handleError(error);
            }
        });
    }

    /**
     * Ferme le modal de détails
     */
    closeDetailsModal(): void {
        this.showDetailsModal = false;
        this.selectedLog = null;
    }

    /**
     * Retourne les changements entre oldValues et newValues
     */
    getChanges(log: AuditLogDetail): any[] {
        if (!log.oldValues || !log.newValues) return [];

        const changes: any[] = [];
        const allKeys = new Set([
            ...Object.keys(log.oldValues),
            ...Object.keys(log.newValues)
        ]);

        allKeys.forEach(key => {
            const oldValue = log.oldValues[key];
            const newValue = log.newValues[key];

            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changes.push({
                    field: key,
                    oldValue: this.formatValue(oldValue),
                    newValue: this.formatValue(newValue)
                });
            }
        });

        return changes;
    }

    /**
     * Formate une valeur pour l'affichage
     */
    private formatValue(value: any): string {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
        if (typeof value === 'object') return JSON.stringify(value);
        return value.toString();
    }

    /**
     * Sauvegarde les filtres dans localStorage
     */
    saveFilters(): void {
        localStorage.setItem('audit-filters-favorite', JSON.stringify(this.filters));
    }

    /**
     * Charge les filtres sauvegardés
     */
    loadSavedFilters(): void {
        const saved = localStorage.getItem('audit-filters-favorite');
        if (saved) {
            try {
                const savedFilters = JSON.parse(saved);
                // Ne pas restaurer la page
                savedFilters.page = 1;
                this.filters = savedFilters;
            } catch (e) {
                console.error('Error loading saved filters:', e);
            }
        }
    }

    /**
     * Gestion des erreurs
     */
    private handleError(error: any): void {
        if (error.message.includes('403') || error.message.includes('accès')) {
            // Rediriger vers la page d'accueil si pas de permissions
            setTimeout(() => {
                this.router.navigate(['/home']);
            }, 3000);
        }
    }

    /**
     * Groupe les logs par jour
     */
    getLogsByDay(): { date: string; logs: AuditLog[] }[] {
        const grouped = new Map<string, AuditLog[]>();

        this.logs.forEach(log => {
            const date = new Date(log.createdAt).toLocaleDateString('fr-FR');
            if (!grouped.has(date)) {
                grouped.set(date, []);
            }
            grouped.get(date)!.push(log);
        });

        return Array.from(grouped.entries()).map(([date, logs]) => ({ date, logs }));
    }

    /**
     * Retourne vers la page des rapports
     */
    navigateToReports(): void {
        this.router.navigate(['/rapports']);
    }

    /**
     * Export PDF (à implémenter)
     */
    async exportToPDF(): Promise<void> {
        try {
            await this.auditService.exportToPDF(this.filters);
            // TODO: Télécharger le fichier
        } catch (error: any) {
            this.errorMessage = error.message;
        }
    }
}
