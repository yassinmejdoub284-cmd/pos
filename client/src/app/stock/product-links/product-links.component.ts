import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../../core/services/products.service';
import { CommonModule } from '@angular/common';

interface ProductLink {
  id: number;
  sourceProduct: {
    id: number;
    name: string;
    barcode: string | null;
  };
  sourceDepot: {
    id: number;
    name: string;
    code: string;
    city: string;
    type: string;
  };
  destinationProduct: {
    id: number;
    name: string;
    barcode: string | null;
  };
  destinationDepot: {
    id: number;
    name: string;
    code: string;
    city: string;
    type: string;
  };
  createdAt: string;
}

interface GroupedLink {
  destinationProduct: {
    id: number;
    name: string;
    barcode: string | null;
  };
  destinationDepot: {
    id: number;
    name: string;
    code: string;
    city: string;
    type: string;
  };
  sourceLinks: ProductLink[];
}

@Component({
  selector: 'app-product-links',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-links.component.html',
  styleUrls: ['./product-links.component.css']
})
export class ProductLinksComponent implements OnInit {
  links: ProductLink[] = [];
  groupedLinks: GroupedLink[] = [];
  loading = false;
  error: string | null = null;

  constructor(private productsService: ProductsService) {}

  ngOnInit(): void {
    this.loadLinks();
  }

  loadLinks(): void {
    this.loading = true;
    this.error = null;
    
    this.productsService.getAllProductDepotLinks().subscribe({
      next: (links) => {
        this.links = links;
        this.groupLinks();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading product links:', error);
        this.error = 'Erreur lors du chargement des liaisons';
        this.loading = false;
      }
    });
  }

  groupLinks(): void {
    const groupedMap = new Map<string, GroupedLink>();

    this.links.forEach(link => {
      const key = `${link.destinationProduct.id}-${link.destinationDepot.id}`;
      
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          destinationProduct: link.destinationProduct,
          destinationDepot: link.destinationDepot,
          sourceLinks: []
        });
      }
      
      groupedMap.get(key)!.sourceLinks.push(link);
    });

    this.groupedLinks = Array.from(groupedMap.values());
  }

  deleteLink(linkId: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette liaison ?')) {
      return;
    }

    this.productsService.deleteProductDepotLink(linkId).subscribe({
      next: () => {
        this.loadLinks();
      },
      error: (error) => {
        console.error('Error deleting link:', error);
        alert('Erreur lors de la suppression de la liaison');
      }
    });
  }
}

