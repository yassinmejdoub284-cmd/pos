import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SalonService, Salon, Table } from '../core/services/salon.service';
import { AddTableDialogComponent } from './dialogs/add-table-dialog.component';
import { EditTableDialogComponent } from './dialogs/edit-table-dialog.component';
import { AddSalonDialogComponent } from './dialogs/add-salon-dialog.component';
import { EditSalonDialogComponent } from './dialogs/edit-salon-dialog.component';
import { DuplicateTableDialogComponent } from './dialogs/duplicate-table-dialog.component';

// Vibrant pastel color palette for tables
const COLOR_PALETTE = [
  '#FDE68A', // Warm Pastel Yellow
  '#FCA5A5', // Soft Coral Pink
  '#A7F3D0', // Mint Green
  '#C4B5FD', // Lavender Purple
  '#FDBA74', // Peach Orange
  '#93C5FD', // Sky Blue
  '#FBCFE8', // Rose Pink
  '#C7D2FE', // Periwinkle Blue
  '#D1FAE5', // Light Green
  '#FECACA', // Light Rose
  '#DCFCE7', // Fresh Green
  '#F3E8FF'  // Light Purple
];

@Component({
  selector: 'app-tables-salon',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AddTableDialogComponent,
    EditTableDialogComponent,
    AddSalonDialogComponent,
    EditSalonDialogComponent,
    DuplicateTableDialogComponent
  ],
  templateUrl: './tables-salon.component.html',
  styleUrls: ['./tables-salon.component.css']
})
export class TablesSalonComponent implements OnInit {
  salons = signal<Salon[]>([]);
  tables = signal<Table[]>([]);
  colorPalette = COLOR_PALETTE;

  // Dialog states
  showAddTableDialog = signal(false);
  showEditTableDialog = signal(false);
  showAddSalonDialog = signal(false);
  showEditSalonDialog = signal(false);
  showDuplicateTableDialog = signal(false);
  
  // Current editing items
  currentTable = signal<Table | null>(null);
  currentSalon = signal<Salon | null>(null);
  tableToDuplicate = signal<Table | null>(null);

  constructor(
    private salonService: SalonService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSalons();
    this.loadTables();
  }

  goBackToHome(): void {
    this.router.navigate(['/home']);
  }

  loadSalons(): void {
    this.salonService.getSalons().subscribe({
      next: (salons) => this.salons.set(salons),
      error: (error) => console.error('Error loading salons:', error)
    });
  }

  loadTables(): void {
    this.salonService.getTables().subscribe({
      next: (tables) => this.tables.set(tables),
      error: (error) => console.error('Error loading tables:', error)
    });
  }


  // Dialog open methods
  openAddTableDialog(): void {
    this.showAddTableDialog.set(true);
  }

  openAddSalonDialog(): void {
    this.showAddSalonDialog.set(true);
  }

  openEditTableDialog(table: Table): void {
    this.currentTable.set(table);
    this.showEditTableDialog.set(true);
  }

  openEditSalonDialog(salon: Salon): void {
    this.currentSalon.set(salon);
    this.showEditSalonDialog.set(true);
  }

  openDuplicateTableDialog(table: Table): void {
    this.tableToDuplicate.set(table);
    this.showDuplicateTableDialog.set(true);
  }

  // Data management methods
  addTable(tableData: Partial<Table>): void {
    this.salonService.createTable(tableData).subscribe({
      next: (table) => {
        this.tables.update(tables => [...tables, table]);
        this.showAddTableDialog.set(false);
      },
      error: (error) => console.error('Error creating table:', error)
    });
  }

  updateTable(tableData: Partial<Table>): void {
    const table = this.currentTable();
    if (table) {
      this.salonService.updateTable(table.id, tableData).subscribe({
        next: (updatedTable) => {
          this.tables.update(tables => 
            tables.map(t => t.id === updatedTable.id ? updatedTable : t)
          );
          this.showEditTableDialog.set(false);
          this.currentTable.set(null);
        },
        error: (error) => console.error('Error updating table:', error)
      });
    }
  }

  deleteTable(): void {
    const table = this.currentTable();
    if (table) {
      this.salonService.deleteTable(table.id).subscribe({
        next: () => {
          this.tables.update(tables => tables.filter(t => t.id !== table.id));
          this.showEditTableDialog.set(false);
          this.currentTable.set(null);
        },
        error: (error) => console.error('Error deleting table:', error)
      });
    }
  }

  addSalon(salonData: Partial<Salon>): void {
    this.salonService.createSalon(salonData).subscribe({
      next: (salon) => {
        this.salons.update(salons => [...salons, salon]);
        this.showAddSalonDialog.set(false);
      },
      error: (error) => console.error('Error creating salon:', error)
    });
  }

  updateSalon(salonData: Partial<Salon>): void {
    const salon = this.currentSalon();
    if (salon) {
      this.salonService.updateSalon(salon.id, salonData).subscribe({
        next: (updatedSalon) => {
          this.salons.update(salons => 
            salons.map(s => s.id === updatedSalon.id ? updatedSalon : s)
          );
          this.showEditSalonDialog.set(false);
          this.currentSalon.set(null);
        },
        error: (error) => console.error('Error updating salon:', error)
      });
    }
  }

  deleteSalon(): void {
    const salon = this.currentSalon();
    if (salon) {
      this.salonService.deleteSalon(salon.id).subscribe({
        next: () => {
          this.salons.update(salons => salons.filter(s => s.id !== salon.id));
          this.tables.update(tables => tables.filter(t => t.salonId !== salon.id));
          this.showEditSalonDialog.set(false);
          this.currentSalon.set(null);
        },
        error: (error) => console.error('Error deleting salon:', error)
      });
    }
  }

  // Dialog close methods
  closeAddTableDialog(): void {
    this.showAddTableDialog.set(false);
  }

  closeEditTableDialog(): void {
    this.showEditTableDialog.set(false);
    this.currentTable.set(null);
  }

  closeAddSalonDialog(): void {
    this.showAddSalonDialog.set(false);
  }

  closeEditSalonDialog(): void {
    this.showEditSalonDialog.set(false);
    this.currentSalon.set(null);
  }

  closeDuplicateTableDialog(): void {
    this.showDuplicateTableDialog.set(false);
    this.tableToDuplicate.set(null);
  }

  getSalonById(salonId: number): Salon | undefined {
    return this.salons().find(s => s.id === salonId);
  }

  getTablesBySalon(salonId: number): Table[] {
    return this.tables()
      .filter(t => t.salonId === salonId)
      .sort((a, b) => {
        // Extract numbers from table numbers for proper sorting
        const matchA = a.number.match(/\d+$/);
        const matchB = b.number.match(/\d+$/);
        const numA = parseInt(matchA ? matchA[0] : '0');
        const numB = parseInt(matchB ? matchB[0] : '0');
        return numA - numB;
      });
  }

  getTablesCountBySalon(salonId: number): number {
    return this.getTablesBySalon(salonId).length;
  }

  // Drag and drop functionality
  onTableDragStart(event: DragEvent, table: Table): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', JSON.stringify(table));
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onSalonDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onSalonDrop(event: DragEvent, targetSalonId: number): void {
    event.preventDefault();
    const tableData = event.dataTransfer?.getData('text/plain');
    if (tableData) {
      const table: Table = JSON.parse(tableData);
      if (table.salonId !== targetSalonId) {
        this.salonService.updateTable(table.id, { salonId: targetSalonId }).subscribe({
          next: (updatedTable) => {
            this.tables.update(tables => 
              tables.map(t => t.id === table.id ? updatedTable : t)
            );
          },
          error: (error) => console.error('Error moving table:', error)
        });
      }
    }
  }

  // Duplicate table functionality
  duplicateTable(count: number): void {
    const originalTable = this.tableToDuplicate();
    if (!originalTable) return;

    const salonTables = this.getTablesBySalon(originalTable.salonId);
    const baseNumber = originalTable.number;
    const baseName = originalTable.name;
    
    const numberMatch = baseNumber.match(/(\d+)$/);
    const baseNumberPrefix = baseNumber.replace(/\d+$/, '');

    // Find the next available sequential numbers
    const existingNumbers = new Set<number>();
    salonTables.forEach(table => {
      const match = table.number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        existingNumbers.add(num);
      }
    });

    const newNumbers: number[] = [];
    let currentNumber = 1;
    while (newNumbers.length < count) {
      if (!existingNumbers.has(currentNumber)) {
        newNumbers.push(currentNumber);
      }
      currentNumber++;
    }

    // Create duplicate tables
    const duplicates: Partial<Table>[] = [];
    for (let i = 0; i < count; i++) {
      const newNumber = baseNumberPrefix + newNumbers[i];
      const newName = baseName.replace(/\d+$/, '') + newNumbers[i];
      
      duplicates.push({
        name: newName,
        number: newNumber,
        color: originalTable.color,
        salonId: originalTable.salonId,
        notes: originalTable.notes
      });
    }

    // Create tables one by one
    let completed = 0;
    duplicates.forEach(duplicate => {
      this.salonService.createTable(duplicate).subscribe({
        next: (newTable) => {
          this.tables.update(tables => [...tables, newTable]);
          completed++;
          if (completed === duplicates.length) {
            this.closeDuplicateTableDialog();
          }
        },
        error: (error) => {
          console.error('Error creating duplicate table:', error);
          completed++;
          if (completed === duplicates.length) {
            this.closeDuplicateTableDialog();
          }
        }
      });
    });
  }

  // Helper methods for duplicate preview
  getDuplicatePreviewNames(): string[] {
    const originalTable = this.tableToDuplicate();
    if (!originalTable) return [];

    const salonTables = this.getTablesBySalon(originalTable.salonId);
    const baseNumber = originalTable.number;
    const baseName = originalTable.name;
    
    const numberMatch = baseNumber.match(/(\d+)$/);
    const baseNumberPrefix = baseNumber.replace(/\d+$/, '');

    const existingNumbers = new Set<number>();
    salonTables.forEach(table => {
      const match = table.number.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        existingNumbers.add(num);
      }
    });

    const newNumbers: number[] = [];
    let currentNumber = 1;
    while (newNumbers.length < 5) {
      if (!existingNumbers.has(currentNumber)) {
        newNumbers.push(currentNumber);
      }
      currentNumber++;
    }

    const previewNames: string[] = [];
    for (let i = 0; i < newNumbers.length; i++) {
      const newName = baseName.replace(/\d+$/, '') + newNumbers[i];
      previewNames.push(newName);
    }
    
    return previewNames;
  }

  getRemainingDuplicateCount(): number {
    return Math.max(0, 5 - this.getDuplicatePreviewNames().length);
  }
}
