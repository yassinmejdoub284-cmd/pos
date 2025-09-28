import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export interface ForeignKeyConstraintError {
  type: 'foreign_key_constraint';
  message: string;
  constraint?: string;
  dependents?: {
    table: string;
    count: number;
    link?: string;
  }[];
}

export interface ErrorDialogData {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  showDependents?: boolean;
  dependents?: {
    table: string;
    count: number;
    link?: string;
  }[];
  primaryAction?: {
    label: string;
    action: () => void;
  };
  secondaryAction?: {
    label: string;
    action: () => void;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlingService {

  /**
   * Parses HTTP errors and extracts foreign key constraint information
   */
  parseForeignKeyError(error: HttpErrorResponse): ForeignKeyConstraintError | null {
    if (error.status !== 400) {
      return null;
    }

    const errorBody = error.error;
    if (!errorBody || !errorBody.error) {
      return null;
    }

    const errorMessage = errorBody.error.toLowerCase();
    
    // Check for common foreign key constraint error patterns
    if (this.isForeignKeyConstraintError(errorMessage)) {
      return {
        type: 'foreign_key_constraint',
        message: this.getUserFriendlyMessage(errorMessage),
        constraint: this.extractConstraintName(errorMessage),
        dependents: this.extractDependents(errorMessage, errorBody)
      };
    }

    return null;
  }

  /**
   * Checks if an error message indicates a foreign key constraint violation
   */
  private isForeignKeyConstraintError(message: string): boolean {
    const fkPatterns = [
      'foreign key constraint',
      'cannot delete',
      'being used by',
      'referenced by',
      'has dependent',
      'constraint violation',
      'impossible de supprimer',
      'utilisé par',
      'référencé par',
      'contrainte de clé étrangère'
    ];

    return fkPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Converts technical error messages to user-friendly French messages
   */
  private getUserFriendlyMessage(message: string): string {
    // If already in French, return as is
    if (message.includes('impossible de supprimer') || message.includes('utilisé par')) {
      return message;
    }

    // Convert English messages to French
    if (message.includes('cannot delete') && message.includes('being used')) {
      return 'Impossible de supprimer : des éléments sont liés.';
    }

    if (message.includes('foreign key constraint')) {
      return 'Impossible de supprimer : des éléments sont liés.';
    }

    if (message.includes('referenced by')) {
      return 'Impossible de supprimer : des éléments sont liés.';
    }

    return 'Impossible de supprimer : des éléments sont liés.';
  }

  /**
   * Extracts constraint name from error message
   */
  private extractConstraintName(message: string): string | undefined {
    const constraintMatch = message.match(/constraint[:\s]+([a-zA-Z_]+)/i);
    return constraintMatch ? constraintMatch[1] : undefined;
  }

  /**
   * Extracts dependent entities information from error message
   */
  private extractDependents(message: string, errorBody?: any): { table: string; count: number; link?: string }[] {
    const dependents: { table: string; count: number; link?: string }[] = [];

    // First, try to get dependents from the error body if available
    if (errorBody && errorBody.dependents && Array.isArray(errorBody.dependents)) {
      return errorBody.dependents.map((dep: any) => ({
        table: this.getTableDisplayName(dep.table),
        count: dep.count || 1,
        link: this.getTableLink(dep.table)
      }));
    }

    // Fallback: Try to extract table names and counts from message
    const tablePatterns = [
      { pattern: /vehicles?/gi, name: 'véhicules', link: '/stock/vehicles' },
      { pattern: /brands?/gi, name: 'marques', link: '/stock/vehicles/brands' },
      { pattern: /models?/gi, name: 'modèles', link: '/stock/vehicles/brands' },
      { pattern: /clients?/gi, name: 'clients', link: '/clients' },
      { pattern: /products?/gi, name: 'produits', link: '/stock/produits' },
      { pattern: /sales?/gi, name: 'ventes', link: '/historique' },
      { pattern: /invoices?/gi, name: 'factures', link: '/invoices' }
    ];

    tablePatterns.forEach(({ pattern, name, link }) => {
      const matches = message.match(pattern);
      if (matches) {
        dependents.push({
          table: name,
          count: matches.length,
          link
        });
      }
    });

    // If no specific dependents found, add a generic one
    if (dependents.length === 0) {
      dependents.push({
        table: 'éléments liés',
        count: 1
      });
    }

    return dependents;
  }

  /**
   * Gets display name for table
   */
  private getTableDisplayName(table: string): string {
    const tableNames: { [key: string]: string } = {
      'vehicles': 'véhicules',
      'brands': 'marques',
      'models': 'modèles',
      'clients': 'clients',
      'products': 'produits',
      'sales': 'ventes',
      'invoices': 'factures'
    };
    return tableNames[table] || table;
  }

  /**
   * Gets link for table
   */
  private getTableLink(table: string): string | undefined {
    const tableLinks: { [key: string]: string } = {
      'vehicles': '/stock/vehicles',
      'brands': '/stock/vehicles/brands',
      'models': '/stock/vehicles/brands',
      'clients': '/clients',
      'products': '/stock/produits',
      'sales': '/historique',
      'invoices': '/invoices'
    };
    return tableLinks[table];
  }

  /**
   * Creates error dialog data for foreign key constraint errors
   */
  createForeignKeyErrorDialog(
    fkError: ForeignKeyConstraintError,
    primaryAction?: () => void,
    secondaryAction?: () => void
  ): ErrorDialogData {
    return {
      title: 'Suppression impossible',
      message: fkError.message,
      type: 'error',
      showDependents: fkError.dependents && fkError.dependents.length > 0,
      dependents: fkError.dependents,
      primaryAction: primaryAction ? {
        label: 'Fermer',
        action: primaryAction
      } : undefined,
      secondaryAction: secondaryAction ? {
        label: 'Voir les éléments liés',
        action: secondaryAction
      } : undefined
    };
  }

  /**
   * Creates a generic error dialog for non-foreign key errors
   */
  createGenericErrorDialog(
    error: HttpErrorResponse,
    primaryAction?: () => void
  ): ErrorDialogData {
    let message = 'Une erreur est survenue.';
    
    if (error.error && error.error.error) {
      message = error.error.error;
    } else if (error.message) {
      message = error.message;
    }

    return {
      title: 'Erreur',
      message,
      type: 'error',
      primaryAction: primaryAction ? {
        label: 'Fermer',
        action: primaryAction
      } : undefined
    };
  }
}
