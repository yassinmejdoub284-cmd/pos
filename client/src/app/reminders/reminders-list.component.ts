import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { RemindersService } from '../core/services/reminders.service';
import { Reminder } from '../core/models/reminder.model';

@Component({
  selector: 'app-reminders-list',
  template: `
  <div class="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 p-4 md:p-6">
    <!-- Header Section -->
    <div class="mb-6">
    <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-4">
          <button routerLink="/home" class="flex items-center space-x-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
            <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
            <span class="text-purple-700 font-medium">Accueil</span>
          </button>
          <div>
            <h1 class="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
              Rappels Administration
            </h1>
            <p class="text-gray-600 text-sm">Gérez et suivez tous vos rappels</p>
          </div>
        </div>
        <a routerLink="/reminders/nouveau" class="group relative px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            <span class="font-semibold">Nouveau Rappel</span>
          </div>
          <div class="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </a>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-gradient-to-br from-pink-100 to-rose-200 rounded-2xl p-4 border border-pink-200/50 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-pink-700 text-sm font-medium">Total</p>
              <p class="text-2xl font-bold text-pink-800">{{ reminders.length }}</p>
            </div>
            <div class="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-blue-100 to-cyan-200 rounded-2xl p-4 border border-blue-200/50 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-blue-700 text-sm font-medium">Actifs</p>
              <p class="text-2xl font-bold text-blue-800">{{ getActiveCount() }}</p>
            </div>
            <div class="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-yellow-100 to-amber-200 rounded-2xl p-4 border border-yellow-200/50 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-yellow-700 text-sm font-medium">En Pause</p>
              <p class="text-2xl font-bold text-yellow-800">{{ getPausedCount() }}</p>
            </div>
            <div class="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-green-100 to-emerald-200 rounded-2xl p-4 border border-green-200/50 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-green-700 text-sm font-medium">Vocal</p>
              <p class="text-2xl font-bold text-green-800">{{ getVoiceCount() }}</p>
            </div>
            <div class="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl p-6">
      <!-- Search and Filters -->
      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <div class="flex-1">
          <div class="relative">
            <input [(ngModel)]="query" placeholder="Rechercher par titre ou description..." 
                   class="w-full px-4 py-3 pl-12 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300">
            <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
        </div>
        <div class="flex gap-2">
          <select [(ngModel)]="statusFilter" class="px-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="PAUSED">En pause</option>
            <option value="CANCELLED">Annulé</option>
            <option value="DELETED">Supprimé</option>
          </select>
          <select [(ngModel)]="priorityFilter" class="px-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            <option value="">Toutes priorités</option>
            <option value="ELEVEE">Élevée</option>
            <option value="NORMAL">Normale</option>
            <option value="FAIBLE">Faible</option>
          </select>
        </div>
      </div>

      <!-- Reminders Grid -->
      <div *ngIf="filtered().length === 0" class="text-center py-12">
        <div class="w-24 h-24 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-600 mb-2">Aucun rappel trouvé</h3>
        <p class="text-gray-500">Créez votre premier rappel pour commencer</p>
      </div>

      <div class="grid gap-4">
        <div *ngFor="let r of filtered(); let i = index" 
             class="group bg-gradient-to-r from-white to-gray-50/50 rounded-2xl border border-gray-200/50 p-6 hover:shadow-lg transition-all duration-300 hover:border-purple-200/50">
          
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <div class="flex items-center space-x-3 mb-2">
                <h3 class="text-lg font-bold text-gray-800 group-hover:text-purple-700 transition-colors">{{ r.title }}</h3>
                <span [ngClass]="getPriorityBadgeClass(r.priority)" class="px-3 py-1 rounded-full text-xs font-semibold">
                  {{ formatPriority(r.priority) }}
                </span>
                <span [ngClass]="getStatusBadgeClass(r.status)" class="px-3 py-1 rounded-full text-xs font-semibold">
                  {{ formatStatus(r.status) }}
                </span>
              </div>
              <p class="text-gray-600 text-sm mb-3">{{ r.description || 'Aucune description' }}</p>
              
              <div class="flex flex-wrap gap-4 text-sm text-gray-500">
                <div class="flex items-center space-x-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>{{ formatDue(r.dueAt) }}</span>
                </div>
                <div class="flex items-center space-x-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  <span>{{ formatAudience(r) }}</span>
                </div>
                <div class="flex items-center space-x-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  <span>{{ formatRecurrence(r) }}</span>
                </div>
                <div *ngIf="r.voiceMessageUrl" class="flex items-center space-x-1 text-green-600">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  <span class="font-medium">Vocal</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2 pt-4 border-t border-gray-200/50">
            <button (click)="editReminder(r)" class="px-4 py-2 bg-blue-500/10 text-blue-600 rounded-lg border border-blue-200/50 hover:bg-blue-500/20 transition-colors text-sm font-medium">
              Modifier
            </button>
            <button (click)="duplicateReminder(r)" class="px-4 py-2 bg-purple-500/10 text-purple-600 rounded-lg border border-purple-200/50 hover:bg-purple-500/20 transition-colors text-sm font-medium">
              Dupliquer
            </button>
            <button (click)="togglePause(r)" class="px-4 py-2 bg-yellow-500/10 text-yellow-600 rounded-lg border border-yellow-200/50 hover:bg-yellow-500/20 transition-colors text-sm font-medium">
              {{ r.status === 'PAUSED' ? 'Reprendre' : 'Pause' }}
            </button>
            <button (click)="cancelReminder(r)" class="px-4 py-2 bg-orange-500/10 text-orange-600 rounded-lg border border-orange-200/50 hover:bg-orange-500/20 transition-colors text-sm font-medium">
              Annuler
            </button>
            <button (click)="deleteReminder(r)" class="px-4 py-2 bg-red-500/10 text-red-600 rounded-lg border border-red-200/50 hover:bg-red-500/20 transition-colors text-sm font-medium">
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class RemindersListComponent implements OnInit {
  reminders: Reminder[] = [];
  query = '';
  statusFilter = '';
  priorityFilter = '';

  constructor(private remindersService: RemindersService, private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    // For list, reuse admin list endpoint through HttpClient directly
    this.remindersService['http'].get<Reminder[]>(`${(this.remindersService as any).API_URL}`).subscribe({
      next: (data) => this.reminders = data || [],
      error: () => this.reminders = []
    });
  }

  filtered(): Reminder[] {
    let filtered = this.reminders;
    
    // Text search
    const q = this.query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(r => (r.title + ' ' + (r.description || '')).toLowerCase().includes(q));
    }
    
    // Status filter
    if (this.statusFilter) {
      filtered = filtered.filter(r => r.status === this.statusFilter);
    }
    
    // Priority filter
    if (this.priorityFilter) {
      filtered = filtered.filter(r => r.priority === this.priorityFilter);
    }
    
    return filtered;
  }

  getActiveCount(): number {
    return this.reminders.filter(r => r.status === 'ACTIVE').length;
  }

  getPausedCount(): number {
    return this.reminders.filter(r => r.status === 'PAUSED').length;
  }

  getVoiceCount(): number {
    return this.reminders.filter(r => r.voiceMessageUrl).length;
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'ELEVEE':
        return 'bg-red-100 text-red-700 border border-red-200';
      case 'FAIBLE':
        return 'bg-green-100 text-green-700 border border-green-200';
      default:
        return 'bg-blue-100 text-blue-700 border border-blue-200';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-700 border border-green-200';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700 border border-red-200';
      case 'DELETED':
        return 'bg-gray-100 text-gray-700 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  }

  formatDue(dueAt: string): string {
    const d = new Date(dueAt); const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.toLocaleDateString()} ${hh}:${mm}`;
  }
  formatPriority(p: string): string { return p === 'ELEVEE' ? 'Élevée' : p === 'FAIBLE' ? 'Faible' : 'Normal'; }
  formatAudience(r: Reminder): string {
    switch (r.targetType) {
      case 'ME': return 'Moi';
      case 'USERS': return 'Utilisateurs';
      case 'ROLES': return 'Rôles';
      case 'ALL_COMPANY': return 'Tous (Société)';
      default: return '';
    }
  }
  formatRecurrence(r: Reminder): string {
    switch (r.recurrenceType) {
      case 'DAILY': return 'Quotidien';
      case 'WEEKLY': return 'Hebdomadaire';
      case 'MONTHLY': return 'Mensuel';
      case 'ADVANCED': return r.recurrenceText || 'Avancé';
      default: return 'Aucune';
    }
  }
  formatStatus(s: string): string { 
    switch (s) {
      case 'ACTIVE': return 'Actif';
      case 'PAUSED': return 'En pause';
      case 'CANCELLED': return 'Annulé';
      case 'DELETED': return 'Supprimé';
      default: return 'Inconnu';
    }
  }

  editReminder(reminder: Reminder): void {
    // Navigate to edit page
    this.router.navigate(['/reminders/edit', reminder.id]);
  }

  duplicateReminder(reminder: Reminder): void {
    // Navigate to new reminder page with pre-filled data
    const queryParams = {
      duplicate: 'true',
      title: reminder.title,
      description: reminder.description,
      priority: reminder.priority,
      targetType: reminder.targetType,
      recurrenceType: reminder.recurrenceType,
      recurrenceText: reminder.recurrenceText,
      allowVoiceResponses: reminder.allowVoiceResponses
    };
    this.router.navigate(['/reminders/nouveau'], { queryParams });
  }

  togglePause(reminder: Reminder): void {
    const action = reminder.status === 'PAUSED' ? 'resume' : 'pause';
    const actionText = action === 'pause' ? 'mis en pause' : 'repris';
    
    this.http.post(`${this.remindersService['API_URL']}/${reminder.id}/action`, { action }).subscribe({
      next: () => {
        // Update local state
        reminder.status = action === 'pause' ? 'PAUSED' : 'ACTIVE';
        alert(`Rappel ${actionText} avec succès.`);
      },
      error: (e) => {
        alert('Erreur: ' + (e.error?.error || 'Action échouée'));
      }
    });
  }

  cancelReminder(reminder: Reminder): void {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce rappel ?')) {
      return;
    }
    
    this.http.post(`${this.remindersService['API_URL']}/${reminder.id}/action`, { action: 'cancel' }).subscribe({
      next: () => {
        // Update local state
        reminder.status = 'CANCELLED';
        alert('Rappel annulé avec succès.');
      },
      error: (e) => {
        alert('Erreur: ' + (e.error?.error || 'Annulation échouée'));
      }
    });
  }

  deleteReminder(reminder: Reminder): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce rappel ?')) {
      return;
    }
    
    this.http.post(`${this.remindersService['API_URL']}/${reminder.id}/action`, { action: 'delete' }).subscribe({
      next: (response: any) => {
        if (response.deleted) {
          // Remove from local list
          this.reminders = this.reminders.filter(r => r.id !== reminder.id);
          alert('Rappel supprimé avec succès.');
        } else {
          alert('Erreur: Réponse inattendue du serveur');
        }
      },
      error: (e) => {
        alert('Erreur: ' + (e.error?.error || 'Suppression échouée'));
      }
    });
  }
}


