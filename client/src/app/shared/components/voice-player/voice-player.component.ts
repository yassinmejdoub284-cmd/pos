import { Component, Input, Output, EventEmitter, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-voice-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-lavande-50 rounded-2xl p-3 border border-lavande-200">
      <div class="flex items-center space-x-3">
        <button 
          (click)="togglePlayback()" 
          class="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center flex-shrink-0"
        >
          <svg *ngIf="!isPlaying()" class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg *ngIf="isPlaying()" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium text-slate-800">Message vocal</span>
            <span class="text-xs text-slate-500">{{ formatTime(currentTime()) }} / {{ formatTime(audioDuration()) }}</span>
          </div>
          
          <div class="bg-white rounded-full h-2 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-100" 
                 [style.width.%]="progress()"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bg-lavande-50 { background-color: #f3f4f6; }
    .border-lavande-200 { border-color: #e5e7eb; }
  `]
})
export class VoicePlayerComponent implements OnDestroy {
  @Input() audioUrl?: string;
  @Input() duration?: number;
  @Output() playbackComplete = new EventEmitter<void>();

  isPlaying = signal(false);
  currentTime = signal(0);
  progress = signal(0);
  audioDuration = signal(0);

  private audioElement?: HTMLAudioElement;
  private progressInterval?: number;

  ngOnDestroy(): void {
    this.cleanup();
  }

  ngOnChanges(): void {
    if (this.audioUrl) {
      this.loadAudio();
    }
  }

  private getFullAudioUrl(): string {
    if (!this.audioUrl) return '';
    
    // If it's already a full URL (starts with http), return as is
    if (this.audioUrl.startsWith('http')) {
      return this.audioUrl;
    }
    
    // If it's a relative URL, prepend the backend URL
    const backendUrl = environment.apiUrl.replace('/api', '');
    return `${backendUrl}${this.audioUrl}`;
  }

  private loadAudio(): void {
    this.cleanup();
    
    if (!this.audioUrl) return;

    const fullUrl = this.getFullAudioUrl();
    this.audioElement = new Audio(fullUrl);
    this.audioDuration.set(this.duration || 0);

    this.audioElement.onloadedmetadata = () => {
      this.audioDuration.set(this.audioElement!.duration);
    };

    this.audioElement.ontimeupdate = () => {
      if (this.audioElement) {
        this.currentTime.set(this.audioElement.currentTime);
        const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        this.progress.set(progress);
      }
    };

    this.audioElement.onended = () => {
      this.isPlaying.set(false);
      this.currentTime.set(0);
      this.progress.set(0);
      this.playbackComplete.emit();
    };

    this.audioElement.onerror = () => {
      this.isPlaying.set(false);
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

  private cleanup(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = undefined;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
