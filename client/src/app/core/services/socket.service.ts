import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface SocketEvent {
  type: string;
  data: any;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private readonly SOCKET_URL = environment.socketUrl;
  
  public isConnected = signal(false);
  public connectionStatus = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('disconnected');

  constructor(private authService: AuthService) {}

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.authService.getToken();
    if (!token) return;

    this.connectionStatus.next('connecting');
    
    this.socket = io(this.SOCKET_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      this.connectionStatus.next('connected');
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
      this.connectionStatus.next('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.connectionStatus.next('disconnected');
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected.set(false);
      this.connectionStatus.next('disconnected');
    }
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on(event, (data) => {
          observer.next(data);
        });
      }
    });
  }

  onStockUpdate(): Observable<any> {
    return this.on('stock_update');
  }

  onSaleCreated(): Observable<any> {
    return this.on('sale_created');
  }

  onTransferRequest(): Observable<any> {
    return this.on('transfer_request');
  }

  onTransferApproved(): Observable<any> {
    return this.on('transfer_approved');
  }

  onTransferCompleted(): Observable<any> {
    return this.on('transfer_completed');
  }

  onNotification(): Observable<any> {
    return this.on('notification');
  }

  joinDepot(depotId: number): void {
    this.emit('join_depot', { depotId });
  }

  leaveDepot(depotId: number): void {
    this.emit('leave_depot', { depotId });
  }

  requestStockTransfer(transferData: any): void {
    this.emit('request_transfer', transferData);
  }

  approveTransfer(transferId: number, approved: boolean): void {
    this.emit('approve_transfer', { transferId, approved });
  }
} 