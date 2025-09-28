import { Injectable, ComponentRef, ViewContainerRef, TemplateRef } from '@angular/core';
import { ErrorDialogComponent } from '../components/error-dialog/error-dialog.component';
import { ErrorDialogData } from '../../core/services/error-handling.service';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private viewContainerRef: ViewContainerRef | null = null;

  setViewContainerRef(viewContainerRef: ViewContainerRef): void {
    this.viewContainerRef = viewContainerRef;
  }

  /**
   * Shows an error dialog with the provided data
   */
  showErrorDialog(data: ErrorDialogData): void {
    if (!this.viewContainerRef) {
      console.error('ViewContainerRef not set. Call setViewContainerRef() first.');
      return;
    }

    // Clear any existing dialogs
    this.viewContainerRef.clear();

    // Create the error dialog component
    const componentRef = this.viewContainerRef.createComponent(ErrorDialogComponent);
    
    // Set the dialog data as input
    componentRef.setInput('data', data);

    // Handle dialog close
    componentRef.instance.close.subscribe(() => {
      this.closeDialog(componentRef);
    });
  }

  /**
   * Closes the current dialog
   */
  closeDialog(componentRef?: ComponentRef<any>): void {
    if (this.viewContainerRef) {
      this.viewContainerRef.clear();
    }
  }

  /**
   * Shows a confirmation dialog
   */
  showConfirmationDialog(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    const data: ErrorDialogData = {
      title,
      message,
      type: 'warning',
      primaryAction: {
        label: 'Confirmer',
        action: () => {
          onConfirm();
          this.closeDialog();
        }
      },
      secondaryAction: {
        label: 'Annuler',
        action: () => {
          if (onCancel) onCancel();
          this.closeDialog();
        }
      }
    };

    this.showErrorDialog(data);
  }
}
