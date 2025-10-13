import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-drivers',
  templateUrl: './drivers.component.html',
  standalone: false
})
export class DriversComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit(): void {}

  navigateToDriversList(): void {
    this.router.navigate(['/stock/drivers/list']);
  }

  navigateToDriverForm(): void {
    this.router.navigate(['/stock/drivers/new']);
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }
}
