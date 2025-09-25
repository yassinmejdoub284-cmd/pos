import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-parametres-overview',
  templateUrl: './parametres-overview.component.html',
  standalone: false
})
export class ParametresOverviewComponent {
  constructor(private router: Router) {}

  navigate(path: string): void {
    this.router.navigate(['/parametres', path]);
  }
}


