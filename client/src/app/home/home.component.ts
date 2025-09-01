import { Component } from '@angular/core';
import { navigationItems, NavigationItem } from './items';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  standalone: false
})
export class HomeComponent {
  navigationItems: NavigationItem[] = navigationItems;
} 