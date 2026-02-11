import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BaseApiService } from '../../core/services/base-api.service';
import { AuthService } from '../../core/services/auth.service';

export interface AuditLog {
    id: number;
    tableName: string;
    recordId: number;
    action: string;
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
    user: {
        id: number;
        firstName: string;
        lastName: string;
        role: string;
    };
}

export interface AuditLogDetail extends AuditLog {
    oldValues: any;
    newValues: any;
}

export interface AuditLogResponse {
    success: boolean;
    data: AuditLog[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        limit: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

export interface DailyStats {
    totalActions: number;
    creates: number;
    updates: number;
    deletes: number;
    criticalActions: number;
    mostActiveUser: string;
    actionsByTable: { [key: string]: number };
}

export interface User {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuditLogsService extends BaseApiService {
    private auditApiUrl = `${this.apiUrl}/audit-logs`;

    // Cache des utilisateurs pour éviter les N+1 queries
    private usersCache = new Map<number, User>();
    private usersCacheLoaded = false;

    constructor(
        protected override http: HttpClient,
        protected override authService: AuthService
    ) {
        super(http, authService);
    }

    /**
     * Récupère les logs d'audit avec filtres
     */
    getAuditLogs(filters: {
        startDate?: string;
        endDate?: string;
        userId?: number;
        tableName?: string;
        action?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Observable<AuditLogResponse> {
        let params: any = {};

        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        if (filters.userId) params.userId = filters.userId.toString();
        if (filters.tableName) params.tableName = filters.tableName;
        if (filters.action) params.action = filters.action;
        if (filters.search) params.search = filters.search;
        if (filters.page) params.page = filters.page.toString();
        if (filters.limit) params.limit = filters.limit.toString();

        return this.http.get<AuditLogResponse>(this.auditApiUrl, {
            ...this.getRequestOptions(),
            params
        }).pipe(
            catchError(this.handleError.bind(this))
        );
    }

    /**
     * Récupère les détails d'un log spécifique
     */
    getAuditLogDetails(id: number): Observable<AuditLogDetail> {
        return this.http.get<{ success: boolean; data: AuditLogDetail }>(
            `${this.auditApiUrl}/${id}`,
            this.getRequestOptions()
        ).pipe(
            map(response => response.data),
            catchError(this.handleError.bind(this))
        );
    }

    /**
     * Récupère les statistiques du jour
     */
    getDailyStats(): Observable<DailyStats> {
        return this.http.get<{ success: boolean; data: DailyStats }>(
            `${this.auditApiUrl}/stats/daily`,
            this.getRequestOptions()
        ).pipe(
            map(response => response.data),
            catchError(this.handleError.bind(this))
        );
    }

    /**
     * Récupère la liste des utilisateurs pour le cache
     */
    async getUsersForCache(): Promise<Map<number, User>> {
        if (this.usersCacheLoaded && this.usersCache.size > 0) {
            return this.usersCache;
        }

        try {
            const response = await this.http.get<{ success: boolean; data: User[] }>(
                `${this.auditApiUrl}/users/list`,
                this.getRequestOptions()
            ).toPromise();

            if (response && response.success && response.data) {
                response.data.forEach(user => {
                    this.usersCache.set(user.id, user);
                });
                this.usersCacheLoaded = true;
            }

            return this.usersCache;
        } catch (error) {
            console.error('Error loading users cache:', error);
            return this.usersCache;
        }
    }

    /**
     * Récupère un utilisateur depuis le cache
     */
    getUserFromCache(userId: number): User | undefined {
        return this.usersCache.get(userId);
    }

    /**
     * Gestion des erreurs réseau
     */
    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'Une erreur est survenue';

        if (error.status === 0) {
            // Erreur réseau
            errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
        } else if (error.status === 401) {
            // Non authentifié
            errorMessage = 'Vous devez vous reconnecter.';
        } else if (error.status === 403) {
            // Accès refusé
            errorMessage = 'Vous n\'avez pas accès à cette fonctionnalité. Contactez un administrateur.';
        } else if (error.status === 404) {
            // Non trouvé
            errorMessage = 'Ressource non trouvée.';
        } else if (error.status === 500) {
            // Erreur serveur
            errorMessage = 'Erreur serveur. Réessayez plus tard.';
        } else if (error.error?.error) {
            // Message d'erreur du serveur
            errorMessage = error.error.error;
        }

        console.error('API Error:', error);
        return throwError(() => new Error(errorMessage));
    }

    /**
     * Export PDF (à implémenter)
     */
    async exportToPDF(filters: any): Promise<Blob> {
        // TODO: Implémenter l'export PDF
        // Option 1: Générer côté frontend avec jsPDF
        // Option 2: Appeler un endpoint backend qui génère le PDF

        throw new Error('Export PDF non encore implémenté');
    }
}
