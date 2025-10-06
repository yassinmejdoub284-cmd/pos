import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-transport-selector',
  templateUrl: 'transport.selector.component.html',
  standalone: false
})
export class TransportSelectorComponent {
  constructor(private router: Router) {}

  goToVehicles(): void {
    this.router.navigate(['/stock/vehicles']);
  }

  goToDrivers(): void {
    this.router.navigate(['/stock/drivers']);
  }
}
