import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, takeUntil } from 'rxjs';
import { SocketService } from './socket.service';

export interface TicketState {
  currentTicketNumber: number;
  lastTicketDate: string;
  isShiftOpen: boolean;
  sessionId?: number;
  depotId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TicketCounterService {
  private readonly STORAGE_KEY_PREFIX = 'pos_ticket_state_depot_';
  
  private ticketStateSubject = new BehaviorSubject<TicketState>({
    currentTicketNumber: 1,
    lastTicketDate: new Date().toDateString(),
    isShiftOpen: true
  });
  
  public ticketState$ = this.ticketStateSubject.asObservable();

  constructor(private socketService: SocketService) {
    this.loadTicketState();
    this.setupRealTimeSync();
  }

  getCurrentTicketNumber(): number {
    return this.ticketStateSubject.value.currentTicketNumber;
  }

  getTicketState(): TicketState {
    return this.ticketStateSubject.value;
  }

  /**
   * Initialize or bump the current ticket number to a provided value, but never decrease it.
   * Useful to recover numbering from history when local storage was cleared.
   */
  setCurrentTicketNumberIfHigher(nextNumber: number): void {
    const safeNext = Math.max(1, Math.floor(Number(nextNumber) || 1));
    const currentState = this.ticketStateSubject.value;
    if (safeNext <= currentState.currentTicketNumber) {
      return;
    }
    const newState = {
      ...currentState,
      currentTicketNumber: safeNext
    };
    this.updateTicketState(newState);
  }

  /**
   * Force-set current ticket number (never below 1). Use cautiously.
   */
  setCurrentTicketNumber(nextNumber: number): void {
    const safeNext = Math.max(1, Math.floor(Number(nextNumber) || 1));
    const currentState = this.ticketStateSubject.value;
    const newState = {
      ...currentState,
      currentTicketNumber: safeNext
    };
    this.updateTicketState(newState);
  }

  incrementTicketNumber(): void {
    const currentState = this.ticketStateSubject.value;
    const newState = {
      ...currentState,
      currentTicketNumber: currentState.currentTicketNumber + 1
    };
    this.updateTicketState(newState);
  }

  resetTicketCounter(): void {
    const currentState = this.ticketStateSubject.value;
    const newState = {
      currentTicketNumber: 1,
      lastTicketDate: new Date().toDateString(),
      isShiftOpen: true,
      sessionId: undefined,
      depotId: currentState.depotId // Keep current depot ID
    };
    this.updateTicketState(newState);
  }

  clearDepotState(depotId: number): void {
    try {
      const depotSpecificKey = `${this.STORAGE_KEY_PREFIX}${depotId}`;
      localStorage.removeItem(depotSpecificKey);
    } catch (error) {
      console.error('Error clearing depot state:', error);
    }
  }

  setSessionId(sessionId: number): void {
    const currentState = this.ticketStateSubject.value;
    const newState = {
      ...currentState,
      sessionId: sessionId
    };
    this.updateTicketState(newState);
  }

  setDepotId(depotId: number): void {
    const currentState = this.ticketStateSubject.value;
    
    // If depot is changing, load the depot-specific state
    if (currentState.depotId !== depotId) {
      this.loadDepotSpecificState(depotId);
    } else {
      // Just update the depot ID in current state
      const newState = {
        ...currentState,
        depotId: depotId
      };
      this.updateTicketState(newState);
    }
  }

  setShiftOpen(isOpen: boolean): void {
    const currentState = this.ticketStateSubject.value;
    const newState = {
      ...currentState,
      isShiftOpen: isOpen
    };
    this.updateTicketState(newState);
  }

  private updateTicketState(newState: TicketState): void {
    this.ticketStateSubject.next(newState);
    this.saveTicketState(newState);
    
    // Log the update for debugging
    console.debug('[TicketCounter] Updated ticket state:', {
      currentTicketNumber: newState.currentTicketNumber,
      depotId: newState.depotId,
      sessionId: newState.sessionId
    });
  }

  private saveTicketState(state: TicketState): void {
    try {
      if (state.depotId) {
        const depotSpecificKey = `${this.STORAGE_KEY_PREFIX}${state.depotId}`;
        localStorage.setItem(depotSpecificKey, JSON.stringify(state));
      }
    } catch (error) {
      console.error('Error saving ticket state:', error);
    }
  }

  private loadTicketState(): void {
    // Initialize with default state - will be loaded when depot is set
    this.ticketStateSubject.next({
      currentTicketNumber: 1,
      lastTicketDate: new Date().toDateString(),
      isShiftOpen: true
    });
  }

  private loadDepotSpecificState(depotId: number): void {
    try {
      const depotSpecificKey = `${this.STORAGE_KEY_PREFIX}${depotId}`;
      const savedState = localStorage.getItem(depotSpecificKey);
      
      if (savedState) {
        const ticketState = JSON.parse(savedState);
        // Load depot-specific ticket state
        this.ticketStateSubject.next({
          currentTicketNumber: ticketState.currentTicketNumber || 1,
          lastTicketDate: ticketState.lastTicketDate || new Date().toDateString(),
          isShiftOpen: ticketState.isShiftOpen !== false,
          sessionId: ticketState.sessionId,
          depotId: depotId
        });
      } else {
        // Initialize new depot with default state
        this.ticketStateSubject.next({
          currentTicketNumber: 1,
          lastTicketDate: new Date().toDateString(),
          isShiftOpen: true,
          depotId: depotId
        });
      }
    } catch (error) {
      console.error('Error loading depot-specific ticket state:', error);
      // Initialize with default state for this depot
      this.ticketStateSubject.next({
        currentTicketNumber: 1,
        lastTicketDate: new Date().toDateString(),
        isShiftOpen: true,
        depotId: depotId
      });
    }
  }

  private setupRealTimeSync(): void {
    // Listen for ticket creation events from other users
    this.socketService.onTicketCreated().subscribe((data) => {
      const currentState = this.ticketStateSubject.value;
      
      console.debug('[TicketCounter] Received ticket_created event:', {
        data,
        currentState
      });
      
      // Only sync if it's for the same depot
      if (data.depotId === currentState.depotId) {
        // Extract ticket number from the ticket number string
        const extractNumber = (ticketNumber: string): number => {
          if (!ticketNumber) return 0;
          const s = String(ticketNumber);
          if (s.includes('/')) {
            const part = s.split('/')[1];
            const n = parseInt(part, 10);
            return isNaN(n) ? 0 : n;
          }
          const n = parseInt(s, 10);
          return isNaN(n) ? 0 : n;
        };

        const newTicketNumber = extractNumber(data.ticketNumber);
        
        console.debug('[TicketCounter] Extracted ticket number:', {
          ticketNumber: data.ticketNumber,
          extractedNumber: newTicketNumber,
          currentTicketNumber: currentState.currentTicketNumber
        });
        
        // Update ticket counter to be higher than the new ticket
        if (newTicketNumber > 0 && newTicketNumber >= currentState.currentTicketNumber) {
          console.debug('[TicketCounter] Updating ticket counter to:', newTicketNumber + 1);
          this.setCurrentTicketNumberIfHigher(newTicketNumber + 1);
        } else {
          console.debug('[TicketCounter] No update needed - ticket number not higher');
        }
      } else {
        console.debug('[TicketCounter] Ignoring ticket from different depot:', {
          eventDepotId: data.depotId,
          currentDepotId: currentState.depotId
        });
      }
    });
  }
}
