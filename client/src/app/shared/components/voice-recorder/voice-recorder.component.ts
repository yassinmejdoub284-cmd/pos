import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-voice-recorder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <!-- Recording Button -->
      <div class="flex flex-col items-center">
        <button 
          (mousedown)="startRecording()" 
          (mouseup)="stopRecording()" 
          (mouseleave)="stopRecording()"
          (touchstart)="startRecording()" 
          (touchend)="stopRecording()"
          [disabled]="isRecording() || isProcessing()"
          class="w-24 h-24 rounded-full border-4 transition-all duration-200 flex items-center justify-center text-white font-medium text-sm"
          [class]="isRecording() ? 'bg-rose-500 border-rose-300 animate-pulse' : 'bg-gradient-to-br from-rose-400 to-rose-600 border-rose-200'"
        >
          <svg *ngIf="!isRecording()" class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <svg *ngIf="isRecording()" class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
        </button>
        <span class="text-sm text-slate-600 mt-2">Maintenir pour enregistrer</span>
      </div>

      <!-- Recording Timer & Waveform -->
      <div *ngIf="isRecording()" class="text-center space-y-2">
        <div class="text-2xl font-mono text-slate-800">{{ formatTime(recordingTime()) }}</div>
        <div class="flex justify-center space-x-1">
          <div *ngFor="let bar of waveformBars()" 
               class="w-1 bg-gradient-to-t from-rose-300 to-rose-500 rounded-full animate-pulse"
               [style.height.px]="bar"></div>
        </div>
        <div class="text-xs text-slate-500">Relâchez pour prévisualiser — Glissez pour annuler</div>
      </div>

      <!-- Preview -->
      <div *ngIf="previewAudio()" class="bg-lavande-50 rounded-2xl p-4 border border-lavande-200">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium text-slate-800">Aperçu</span>
          <span class="text-xs text-slate-500">{{ formatTime(previewDuration()) }}</span>
        </div>
        
        <div class="flex items-center space-x-3 mb-3">
          <button 
            (click)="togglePlayback()" 
            class="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center"
          >
            <svg *ngIf="!isPlaying()" class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <svg *ngIf="isPlaying()" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
          
          <div class="flex-1 bg-white rounded-full h-2 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-100" 
                 [style.width.%]="playbackProgress()"></div>
          </div>
        </div>

        <div class="flex space-x-2">
          <button 
            (click)="retake()" 
            class="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white"
          >
            Réenregistrer
          </button>
          <button 
            (click)="confirm()" 
            class="flex-1 px-3 py-2 rounded-xl text-white bg-gradient-to-r from-rose-400 to-rose-600"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage()" class="bg-red-50 border border-red-200 rounded-xl p-3">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span class="text-sm text-red-700">{{ errorMessage() }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bg-lavande-50 { background-color: #f3f4f6; }
    .border-lavande-200 { border-color: #e5e7eb; }
  `]
})
export class VoiceRecorderComponent {
  @Input() confirmLabel = 'Joindre au rappel';
  @Input() maxDuration = 60; // seconds
  @Output() recordingComplete = new EventEmitter<{ audioBlob: Blob; duration: number }>();
  @Output() error = new EventEmitter<string>();

  isRecording = signal(false);
  isProcessing = signal(false);
  isPlaying = signal(false);
  recordingTime = signal(0);
  previewAudio = signal<Blob | null>(null);
  previewDuration = signal(0);
  playbackProgress = signal(0);
  waveformBars = signal<number[]>([]);
  errorMessage = signal<string>('');

  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private audioElement?: HTMLAudioElement;
  private recordingInterval?: number;
  private waveformInterval?: number;

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.previewAudio.set(audioBlob);
        this.createAudioElement(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingTime.set(0);
      this.errorMessage.set('');

      // Start timer
      this.recordingInterval = window.setInterval(() => {
        const newTime = this.recordingTime() + 0.1;
        this.recordingTime.set(newTime);
        
        if (newTime >= this.maxDuration) {
          this.stopRecording();
        }
      }, 100);

      // Start waveform animation
      this.waveformInterval = window.setInterval(() => {
        this.waveformBars.set(Array.from({ length: 20 }, () => Math.random() * 30 + 10));
      }, 150);

    } catch (err) {
      this.errorMessage.set('Micro non autorisé');
      this.error.emit('Micro non autorisé');
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
      }
      if (this.waveformInterval) {
        clearInterval(this.waveformInterval);
      }
    }
  }

  private createAudioElement(audioBlob: Blob): void {
    const audioUrl = URL.createObjectURL(audioBlob);
    this.audioElement = new Audio(audioUrl);
    
    this.audioElement.onloadedmetadata = () => {
      this.previewDuration.set(Math.round(this.audioElement!.duration));
    };

    this.audioElement.ontimeupdate = () => {
      if (this.audioElement) {
        const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        this.playbackProgress.set(progress);
      }
    };

    this.audioElement.onended = () => {
      this.isPlaying.set(false);
      this.playbackProgress.set(0);
    };
  }

  togglePlayback(): void {
    if (!this.audioElement) return;

    if (this.isPlaying()) {
      this.audioElement.pause();
      this.isPlaying.set(false);
    } else {
      this.audioElement.play();
      this.isPlaying.set(true);
    }
  }

  retake(): void {
    this.previewAudio.set(null);
    this.previewDuration.set(0);
    this.playbackProgress.set(0);
    this.isPlaying.set(false);
    if (this.audioElement) {
      this.audioElement.pause();
      URL.revokeObjectURL(this.audioElement.src);
    }
  }

  confirm(): void {
    if (this.previewAudio()) {
      this.recordingComplete.emit({
        audioBlob: this.previewAudio()!,
        duration: this.previewDuration()
      });
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
