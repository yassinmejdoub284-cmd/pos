import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DepotsService } from '../../../core/services/depots.service';
import { Depot, DepotType } from '../../../core/models/depot.model';

/**
 * Gestion des depots : creation, renommage, activation/desactivation,
 * suppression. Le renommage agit sur le vrai nom du depot (pas seulement
 * sur le libelle d'impression).
 */
@Component({
  selector: 'app-depots-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './depots-manager.component.html'
})
export class DepotsManagerComponent implements OnInit, OnDestroy {
  depots: Depot[] = [];
  loading = false;
  error = '';
  info = '';

  /** Depot en cours d'edition (null = aucun). */
  editing: Depot | null = null;
  /** Formulaire de creation ouvert ? */
  creating = false;

  form: {
    name: string; code: string; type: DepotType;
    address: string; city: string; phone: string; email: string;
  } = this.emptyForm();

  readonly types: { value: DepotType; label: string }[] = [
    { value: 'SHOP', label: 'Boutique / point de vente' },
    { value: 'MAIN', label: 'Depot principal' },
    { value: 'BRANCH', label: 'Succursale' },
    { value: 'WAREHOUSE', label: 'Entrepot' }
  ];

  private destroy$ = new Subject<void>();

  constructor(private depotsService: DepotsService, private router: Router) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private emptyForm() {
    return { name: '', code: '', type: 'SHOP' as DepotType, address: '', city: '', phone: '', email: '' };
  }

  load(): void {
    this.loading = true; this.error = '';
    this.depotsService.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: (d) => { this.depots = d || []; this.loading = false; },
      error: () => { this.error = 'Impossible de charger les depots.'; this.loading = false; }
    });
  }

  startCreate(): void {
    this.creating = true; this.editing = null;
    this.form = this.emptyForm(); this.error = ''; this.info = '';
  }

  startEdit(depot: Depot): void {
    this.editing = depot; this.creating = false; this.error = ''; this.info = '';
    this.form = {
      name: depot.name || '', code: depot.code || '', type: depot.type,
      address: depot.address || '', city: depot.city || '',
      phone: depot.phone || '', email: depot.email || ''
    };
  }

  cancel(): void { this.creating = false; this.editing = null; this.form = this.emptyForm(); }

  save(): void {
    const name = this.form.name.trim();
    const code = this.form.code.trim();
    if (!name || !code) { this.error = 'Le nom et le code sont obligatoires.'; return; }

    const payload = {
      name, code, type: this.form.type,
      address: this.form.address.trim(), city: this.form.city.trim(),
      phone: this.form.phone.trim(), email: this.form.email.trim()
    };

    this.loading = true; this.error = '';
    const req = this.editing
      ? this.depotsService.update(this.editing.id, payload)
      : this.depotsService.create(payload);

    req.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.info = this.editing ? 'Depot mis a jour.' : 'Depot cree.';
        this.cancel(); this.load();
      },
      error: (e) => {
        this.error = e?.error?.error || 'Enregistrement impossible (le code est peut-etre deja utilise).';
        this.loading = false;
      }
    });
  }

  remove(depot: Depot): void {
    if (!confirm(`Supprimer le depot "${depot.name}" ?\n\nS'il contient des ventes ou des sessions de caisse, il sera desactive et les donnees seront conservees.`)) return;
    this.loading = true; this.error = ''; this.info = '';
    this.depotsService.delete(depot.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.info = res?.message || 'Depot supprime.'; this.load(); },
      error: (e) => { this.error = e?.error?.error || 'Suppression impossible.'; this.loading = false; }
    });
  }

  reactivate(depot: Depot): void {
    this.loading = true; this.error = ''; this.info = '';
    this.depotsService.reactivate(depot.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.info = `"${depot.name}" est de nouveau actif.`; this.load(); },
      error: () => { this.error = 'Reactivation impossible.'; this.loading = false; }
    });
  }

  typeLabel(t: DepotType): string {
    return this.types.find(x => x.value === t)?.label || t;
  }

  goBack(): void { this.router.navigate(['/parametres']); }
}
