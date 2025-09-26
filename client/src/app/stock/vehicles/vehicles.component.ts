import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-vehicles',
  templateUrl: './vehicles.component.html',
  standalone: false
})
export class VehiclesComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit(): void {}

  navigateToVehiclesList(): void {
    this.router.navigate(['/stock/vehicles/list']);
  }

  navigateToVehicleForm(): void {
    this.router.navigate(['/stock/vehicles/form']);
  }

  navigateToVehicleBrands(): void {
    this.router.navigate(['/stock/vehicles/brands']);
  }
}
