import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AuditTranslatorService {

    // Traduction des noms de tables
    private tableNames: { [key: string]: string } = {
        'session_caisse': 'Caisse',
        'sessions_caisse': 'Caisse',
        'SessionCaisse': 'Caisse',
        'expenses': 'Dépense',
        'Expense': 'Dépense',
        'stock_documents': 'Document de stock',
        'StockDocument': 'Document de stock',
        'sales': 'Vente',
        'Sale': 'Vente',
        'ventes': 'Vente',
        'clients': 'Client',
        'Client': 'Client',
        'products': 'Produit',
        'Product': 'Produit',
        'produits': 'Produit',
        'users': 'Utilisateur',
        'User': 'Utilisateur',
        'suppliers': 'Fournisseur',
        'Supplier': 'Fournisseur',
        'inventory': 'Inventaire',
        'Inventory': 'Inventaire',
        'InventorySession': 'Session d\'inventaire',
        'invoices': 'Facture',
        'Invoice': 'Facture',
        'InvoiceRequest': 'Demande de facture',
        'Depot': 'Dépôt',
        'Company': 'Société',
        'ProductFamily': 'Famille de produits',
        'StockMovement': 'Mouvement de stock',
        'ExpenseCategory': 'Catégorie de dépense',
        'PaymentMethod': 'Moyen de paiement',
        'CashMovement': 'Mouvement de caisse',
        'ReturnRequest': 'Demande de retour',
        'RebutRecord': 'Rebut',
        'Vehicle': 'Véhicule',
        'Driver': 'Chauffeur',
        'ChangeRequest': 'Demande de modification',
        'ClientDebtTransaction': 'Transaction dette client',
        'SupplierDebtTransaction': 'Transaction dette fournisseur',
        'SupplierPayment': 'Paiement fournisseur'
    };

    // Traduction des noms de champs
    private fieldTranslations: { [key: string]: string } = {
        'status': 'Statut',
        'countedCash': 'Espèces comptées',
        'openingFund': 'Fond de caisse',
        'closingFund': 'Fond de clôture',
        'variance': 'Différence',
        'amount': 'Montant',
        'description': 'Description',
        'category': 'Catégorie',
        'numero': 'Numéro',
        'type': 'Type',
        'date': 'Date',
        'quantity': 'Quantité',
        'unitPrice': 'Prix unitaire',
        'total': 'Total',
        'firstName': 'Prénom',
        'lastName': 'Nom',
        'email': 'Email',
        'role': 'Rôle',
        'isActive': 'Actif',
        'isPaid': 'Payé',
        'isApproved': 'Approuvé',
        'notes': 'Notes',
        'paymentType': 'Type de paiement',
        'dueDate': 'Date d\'échéance',
        'paidAt': 'Payé le',
        'approvedAt': 'Approuvé le'
    };

    // Icônes par type de table
    private tableIcons: { [key: string]: string } = {
        'session_caisse': '💰',
        'sessions_caisse': '💰',
        'SessionCaisse': '💰',
        'expenses': '💸',
        'Expense': '💸',
        'stock_documents': '📦',
        'StockDocument': '📦',
        'sales': '🛒',
        'Sale': '🛒',
        'ventes': '🛒',
        'clients': '👥',
        'Client': '👥',
        'products': '📦',
        'Product': '📦',
        'produits': '📦',
        'users': '👤',
        'User': '👤',
        'suppliers': '🏭',
        'Supplier': '🏭',
        'inventory': '📊',
        'Inventory': '📊',
        'InventorySession': '📊',
        'invoices': '🧾',
        'Invoice': '🧾',
        'InvoiceRequest': '📄',
        'Depot': '🏪',
        'Company': '🏢',
        'ProductFamily': '📁',
        'StockMovement': '↔️',
        'ExpenseCategory': '🏷️',
        'PaymentMethod': '💳',
        'CashMovement': '💵',
        'ReturnRequest': '↩️',
        'RebutRecord': '🗑️',
        'Vehicle': '🚗',
        'Driver': '👨‍✈️',
        'ChangeRequest': '📝',
        'ClientDebtTransaction': '💰',
        'SupplierDebtTransaction': '💰',
        'SupplierPayment': '💳'
    };

    constructor() { }

    /**
     * Traduit le nom d'une table en français
     */
    translateTableName(tableName: string): string {
        return this.tableNames[tableName] || tableName;
    }

    /**
     * Traduit le nom d'un champ en français
     */
    translateFieldName(fieldName: string): string {
        return this.fieldTranslations[fieldName] || fieldName;
    }

    /**
     * Retourne l'icône pour un type de table
     */
    getTableIcon(tableName: string): string {
        return this.tableIcons[tableName] || '📄';
    }

    /**
     * Génère une description en français simple pour un log d'audit
     */
    generateDescription(log: any): string {
        const userName = log.user ? log.user.firstName : 'Utilisateur';
        const tableName = this.translateTableName(log.tableName);
        const icon = this.getActionIcon(log.action);

        switch (log.action) {
            case 'CREATE':
                return this.generateCreateDescription(userName, tableName, log);
            case 'UPDATE':
                return this.generateUpdateDescription(userName, tableName, log);
            case 'DELETE':
                return this.generateDeleteDescription(userName, tableName, log);
            default:
                return `${icon} ${userName} - ${tableName}`;
        }
    }

    /**
     * Génère une description pour une action CREATE
     */
    private generateCreateDescription(userName: string, tableName: string, log: any): string {
        const verbs: { [key: string]: string } = {
            'Caisse': 'a ouvert',
            'Dépense': 'a enregistré',
            'Document de stock': 'a créé',
            'Vente': 'a enregistré',
            'Client': 'a ajouté',
            'Produit': 'a ajouté',
            'Utilisateur': 'a créé',
            'Fournisseur': 'a ajouté',
            'Facture': 'a créé'
        };

        const verb = verbs[tableName] || 'a créé';
        return `✅ ${userName} ${verb} ${this.getArticle(tableName)} ${tableName.toLowerCase()}`;
    }

    /**
     * Génère une description pour une action UPDATE
     */
    private generateUpdateDescription(userName: string, tableName: string, log: any): string {
        const verbs: { [key: string]: string } = {
            'Caisse': 'a modifié',
            'Dépense': 'a mis à jour',
            'Document de stock': 'a modifié',
            'Vente': 'a modifié',
            'Client': 'a mis à jour',
            'Produit': 'a modifié',
            'Utilisateur': 'a modifié',
            'Fournisseur': 'a mis à jour',
            'Facture': 'a modifié'
        };

        const verb = verbs[tableName] || 'a modifié';
        return `🔄 ${userName} ${verb} ${this.getArticle(tableName)} ${tableName.toLowerCase()}`;
    }

    /**
     * Génère une description pour une action DELETE
     */
    private generateDeleteDescription(userName: string, tableName: string, log: any): string {
        return `❌ ${userName} a supprimé ${this.getArticle(tableName)} ${tableName.toLowerCase()}`;
    }

    /**
     * Retourne l'article approprié (un/une/le/la)
     */
    private getArticle(tableName: string): string {
        const feminine = ['Caisse', 'Dépense', 'Vente', 'Facture'];
        return feminine.includes(tableName) ? 'une' : 'un';
    }

    /**
     * Retourne l'icône pour un type d'action
     */
    getActionIcon(action: string): string {
        switch (action) {
            case 'CREATE': return '✅';
            case 'UPDATE': return '🔄';
            case 'DELETE': return '❌';
            default: return '📝';
        }
    }

    /**
     * Retourne la couleur pour un type d'action
     */
    getActionColor(action: string): string {
        switch (action) {
            case 'CREATE': return 'green';
            case 'UPDATE': return 'blue';
            case 'DELETE': return 'red';
            default: return 'gray';
        }
    }

    /**
     * Parse le user agent pour détecter l'appareil
     */
    parseUserAgent(userAgent: string): string {
        if (!userAgent) return '🖥️ Appareil inconnu';

        if (userAgent.includes('Mobile')) return '📱 Téléphone portable';
        if (userAgent.includes('Tablet') || userAgent.includes('iPad')) return '📱 Tablette';
        if (userAgent.includes('Windows')) return '💻 Ordinateur Windows';
        if (userAgent.includes('Mac')) return '💻 Ordinateur Mac';
        if (userAgent.includes('Linux')) return '💻 Ordinateur Linux';

        return '🖥️ Ordinateur';
    }

    /**
     * Formate un montant en dinars tunisiens
     */
    formatAmount(amount: number | string): string {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(num)) return amount.toString();
        return `${num.toFixed(3)} DT`;
    }

    /**
     * Formate une date en format relatif (Il y a X heures, Hier, etc.)
     */
    formatRelativeDate(date: Date | string): string {
        const now = new Date();
        const targetDate = typeof date === 'string' ? new Date(date) : date;
        const diffMs = now.getTime() - targetDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        // Moins d'1 minute
        if (diffMins < 1) {
            return 'À l\'instant';
        }

        // Moins d'1 heure
        if (diffMins < 60) {
            return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
        }

        // Moins de 24 heures
        if (diffHours < 24) {
            return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
        }

        // Hier
        if (diffDays === 1) {
            const hours = targetDate.getHours().toString().padStart(2, '0');
            const mins = targetDate.getMinutes().toString().padStart(2, '0');
            return `Hier à ${hours}:${mins}`;
        }

        // Moins de 7 jours
        if (diffDays < 7) {
            const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
            const dayName = days[targetDate.getDay()];
            const hours = targetDate.getHours().toString().padStart(2, '0');
            const mins = targetDate.getMinutes().toString().padStart(2, '0');
            return `${dayName} à ${hours}:${mins}`;
        }

        // Plus de 7 jours
        const day = targetDate.getDate();
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
            'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        const month = months[targetDate.getMonth()];
        const hours = targetDate.getHours().toString().padStart(2, '0');
        const mins = targetDate.getMinutes().toString().padStart(2, '0');
        return `${day} ${month} à ${hours}:${mins}`;
    }

    /**
     * Détecte si une action est sensible/critique
     */
    isSensitiveAction(log: any): boolean {
        // Suppression d'utilisateurs, ventes ou caisses
        if (log.action === 'DELETE' &&
            ['users', 'sales', 'ventes', 'session_caisse', 'sessions_caisse'].includes(log.tableName)) {
            return true;
        }

        // Modifications d'utilisateurs (changement de rôle, etc.)
        if (log.tableName === 'users' && log.action === 'UPDATE') {
            return true;
        }

        return false;
    }

    /**
     * Extrait les informations importantes selon le type de table
     */
    extractImportantInfo(log: any, values: any): string {
        if (!values) return '';

        switch (log.tableName) {
            case 'session_caisse':
            case 'sessions_caisse':
                if (values.countedCash) {
                    return `${this.formatAmount(values.countedCash)} en espèces`;
                }
                if (values.status === 'CLOSED') {
                    return 'Session fermée';
                }
                break;

            case 'expenses':
                if (values.amount) {
                    return this.formatAmount(values.amount);
                }
                break;

            case 'stock_documents':
                if (values.numero) {
                    return `N° ${values.numero}`;
                }
                break;

            case 'sales':
            case 'ventes':
                if (values.finalTotal || values.total) {
                    return this.formatAmount(values.finalTotal || values.total);
                }
                break;
        }

        return '';
    }
}
