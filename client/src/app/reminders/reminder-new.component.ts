import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { VoiceRecorderComponent } from '../shared/components/voice-recorder/voice-recorder.component';

@Component({
  selector: 'app-reminder-new',
  template: `
  <div class="p-4 md:p-6">
    <div class="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
      <span class="text-xl font-bold text-slate-800 mb-6 block">Nouveau rappel</span>

      <div class="grid md:grid-cols-2 gap-4 mb-6">
        <button (click)="setMode('TEXT')" [class]="mode==='TEXT' ? 'border-pink-400 ring-2 ring-pink-200' : 'border-slate-200'" class="w-full rounded-2xl border p-6 text-left hover:border-pink-300 transition">
          <span class="text-lg font-semibold block mb-2">Texte</span>
          <span class="text-slate-600 block">Envoyer un court message texte.</span>
        </button>
        <button (click)="setMode('VOICE')" [class]="mode==='VOICE' ? 'border-cyan-400 ring-2 ring-cyan-200' : 'border-slate-200'" class="w-full rounded-2xl border p-6 text-left hover:border-cyan-300 transition">
          <span class="text-lg font-semibold block mb-2">Vocal</span>
          <span class="text-slate-600 block">Maintenir pour enregistrer, puis enregistrer.</span>
        </button>
      </div>

      <div class="mb-6">
        <span class="block text-sm font-medium text-slate-700 mb-3">Destinataire</span>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button (click)="setTarget('ME')" [class]="target==='ME' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50' : 'border-slate-200'" class="rounded-xl border p-4 text-center hover:border-blue-300 transition">
            <span class="text-sm font-medium block">Moi</span>
          </button>
          <button (click)="setTarget('USERS')" [class]="target==='USERS' ? 'border-green-400 ring-2 ring-green-200 bg-green-50' : 'border-slate-200'" class="rounded-xl border p-4 text-center hover:border-green-300 transition">
            <span class="text-sm font-medium block">Utilisateurs</span>
          </button>
          <button (click)="setTarget('ROLES')" [class]="target==='ROLES' ? 'border-purple-400 ring-2 ring-purple-200 bg-purple-50' : 'border-slate-200'" class="rounded-xl border p-4 text-center hover:border-purple-300 transition">
            <span class="text-sm font-medium block">Rôles</span>
          </button>
          <button (click)="setTarget('ALL_COMPANY')" [class]="target==='ALL_COMPANY' ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-50' : 'border-slate-200'" class="rounded-xl border p-4 text-center hover:border-orange-300 transition">
            <span class="text-sm font-medium block">Tous</span>
          </button>
        </div>
      </div>

      <!-- User/Role Selection -->
      <div *ngIf="target==='USERS'" class="mb-6">
        <span class="block text-sm font-medium text-slate-700 mb-3">Sélectionner les utilisateurs</span>
        <div class="space-y-2 max-h-40 overflow-y-auto border rounded-xl p-3">
          <div *ngFor="let user of users" class="flex items-center space-x-3">
            <input type="checkbox" [id]="'user-' + user.id" [(ngModel)]="user.selected" class="rounded">
            <label [for]="'user-' + user.id" class="text-sm cursor-pointer">{{ user.firstName }} {{ user.lastName }} ({{ user.role }})</label>
          </div>
        </div>
      </div>

      <div *ngIf="target==='ROLES'" class="mb-6">
        <span class="block text-sm font-medium text-slate-700 mb-3">Sélectionner les rôles</span>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div *ngFor="let role of availableRoles" class="flex items-center space-x-2">
            <input type="checkbox" [id]="'role-' + role" [(ngModel)]="selectedRoles[role]" class="rounded">
            <label [for]="'role-' + role" class="text-sm cursor-pointer">{{ role }}</label>
          </div>
        </div>
      </div>

      <div *ngIf="mode==='TEXT'" class="space-y-4">
        <div>
          <span class="block text-sm font-medium text-slate-700 mb-2">Message</span>
          <textarea [(ngModel)]="textMessage" rows="4" class="w-full border rounded-xl px-3 py-2" placeholder="Écrire un court rappel..."></textarea>
        </div>
      </div>

      <div *ngIf="mode==='VOICE'" class="space-y-4">
        <app-voice-recorder
          confirmLabel="Utiliser cet enregistrement"
          (recordingComplete)="onVoiceRecorded($event)"
          (error)="onVoiceError($event)">
        </app-voice-recorder>
        <span class="text-xs text-slate-500">Astuce: maintenez le bouton pour enregistrer. Relâchez pour prévisualiser.</span>
      </div>

      <div class="flex justify-end gap-2 mt-8">
        <a routerLink="/reminders" class="px-4 py-2 rounded-xl border">Annuler</a>
        <button (click)="save()" class="px-4 py-2 rounded-xl text-white" style="background: linear-gradient(135deg, #ff6b6b, #00e5ff)">Enregistrer</button>
      </div>
    </div>
  </div>
  `
  ,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, VoiceRecorderComponent]
})
export class ReminderNewComponent implements OnInit {
  mode: 'TEXT' | 'VOICE' = 'TEXT';
  target: 'ME' | 'USERS' | 'ROLES' | 'ALL_COMPANY' = 'ME';
  textMessage = '';
  users: any[] = [];
  availableRoles: string[] = [];
  selectedRoles: { [key: string]: boolean } = {};
  private voiceBlob?: Blob;
  private voiceDurationSec = 0;

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
    this.handleDuplicateData();
  }

  handleDuplicateData(): void {
    this.route.queryParams.subscribe(params => {
      if (params['duplicate'] === 'true') {
        // Pre-fill form with duplicate data
        if (params['title']) this.textMessage = params['title'];
        if (params['description']) this.textMessage = params['description'];
        if (params['priority']) this.target = params['priority'] as any;
        if (params['targetType']) this.target = params['targetType'] as any;
        if (params['recurrenceType']) {
          // Handle recurrence if needed
        }
        if (params['allowVoiceResponses']) {
          // Handle voice responses if needed
        }
      }
    });
  }

  loadUsers(): void {
    this.http.get<any[]>(`${environment.apiUrl}/users`).subscribe({
      next: (data) => {
        this.users = data.map(user => ({ ...user, selected: false }));
      },
      error: () => this.users = []
    });
  }

  loadRoles(): void {
    this.http.get<string[]>(`${environment.apiUrl}/users/roles`).subscribe({
      next: (data) => {
        this.availableRoles = data;
        // Initialize selectedRoles object
        this.availableRoles.forEach(role => {
          this.selectedRoles[role] = false;
        });
      },
      error: () => this.availableRoles = []
    });
  }

  setMode(next: 'TEXT' | 'VOICE'): void {
    this.mode = next;
  }

  setTarget(next: 'ME' | 'USERS' | 'ROLES' | 'ALL_COMPANY'): void {
    this.target = next;
  }

  getSelectedUserIds(): number[] {
    return this.users.filter(user => user.selected).map(user => user.id);
  }

  getSelectedRoles(): string[] {
    return Object.keys(this.selectedRoles).filter(role => this.selectedRoles[role]);
  }

  save(): void {
    // Validate target selection
    if (this.target === 'USERS' && this.getSelectedUserIds().length === 0) {
      alert('Veuillez sélectionner au moins un utilisateur.');
      return;
    }
    if (this.target === 'ROLES' && this.getSelectedRoles().length === 0) {
      alert('Veuillez sélectionner au moins un rôle.');
      return;
    }

    if (this.mode === 'TEXT') {
      const message = (this.textMessage || '').trim();
      if (!message) {
        alert('Veuillez saisir un message.');
        return;
      }
      const nowIso = new Date().toISOString();
      const payload = {
        title: message.slice(0, 50) || 'Rappel',
        description: message,
        dueAt: nowIso,
        timezone: 'Africa/Tunis',
        priority: 'NORMAL',
        targetType: this.target,
        recurrenceType: 'NONE',
        visibilityScope: 'TARGETS',
        snoozeAllowed: true,
        allowVoiceResponses: false,
        ...(this.target === 'USERS' && { userIds: this.getSelectedUserIds() }),
        ...(this.target === 'ROLES' && { roles: this.getSelectedRoles() })
      } as const;
      const api = `${environment.apiUrl}/reminders`;
      this.http.post(api, payload).subscribe({
        next: () => {
          alert('Rappel texte créé.');
          this.router.navigate(['/reminders']);
        },
        error: (e) => alert('Erreur de création du rappel: ' + (e?.error?.error || e?.message || 'Erreur inconnue'))
      });
      return;
    }

    if (!this.voiceBlob) {
      alert('Veuillez enregistrer un message vocal.');
      return;
    }

    const nowIso = new Date().toISOString();
    const payload = {
      title: 'Rappel vocal',
      description: undefined,
      dueAt: nowIso,
      timezone: 'Africa/Tunis',
      priority: 'NORMAL',
      targetType: this.target,
      recurrenceType: 'NONE',
      visibilityScope: 'TARGETS',
      snoozeAllowed: true,
      allowVoiceResponses: false,
      ...(this.target === 'USERS' && { userIds: this.getSelectedUserIds() }),
      ...(this.target === 'ROLES' && { roles: this.getSelectedRoles() })
    } as const;

    const api = `${environment.apiUrl}/reminders`;
    this.http.post(api, payload).subscribe({
      next: (response: any) => {
        const id = response?.id;
        if (!id) {
          alert('Rappel créé, mais identifiant manquant.');
          return;
        }
        this.uploadVoice(id);
      },
      error: (e) => alert('Erreur de création du rappel vocal: ' + (e?.error?.error || e?.message || 'Erreur inconnue'))
    });
  }

  onVoiceRecorded(event: { audioBlob: Blob; duration: number }): void {
    this.voiceBlob = event.audioBlob;
    this.voiceDurationSec = event.duration ?? 0;
  }

  onVoiceError(error: string): void {
    alert('Erreur enregistrement: ' + error);
  }

  private uploadVoice(reminderId: number): void {
    if (!this.voiceBlob) return;
    const formData = new FormData();
    formData.append('voice', this.voiceBlob);
    this.http.post(`${environment.apiUrl}/reminders/${reminderId}/voice`, formData).subscribe({
      next: () => {
        alert('Rappel vocal créé.');
        this.router.navigate(['/reminders']);
      },
      error: (e) => {
        alert('Erreur upload vocal: ' + (e.error?.error || 'Erreur inconnue'));
      }
    });
  }
}


