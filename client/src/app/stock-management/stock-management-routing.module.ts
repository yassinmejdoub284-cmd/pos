import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StockManagementComponent } from './stock-management.component';

const routes: Routes = [
  { path: '', component: StockManagementComponent },
  { 
    path: 'depot-selection', 
    loadChildren: () => import('./depot-selection/depot-selection.module').then(m => m.DepotSelectionModule)
  },
  { 
    path: 'entry-options/:depotId', 
    loadChildren: () => import('./entry-options/entry-options.module').then(m => m.EntryOptionsModule)
  },
  { 
    path: 'new-entry/:depotId', 
    loadChildren: () => import('./new-entry/new-entry.module').then(m => m.NewEntryModule)
  },
  { 
    path: 'new-return/:depotId', 
    loadChildren: () => import('./new-return/new-return.module').then(m => m.NewReturnModule)
  },
  { 
    path: 'import-entry/:depotId', 
    loadChildren: () => import('./import-entry/import-entry.module').then(m => m.ImportEntryModule)
  },
  { 
    path: 'pdf-import/:depotId', 
    loadChildren: () => import('./pdf-import/pdf-import.module').then(m => m.PdfImportModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StockManagementRoutingModule { }
