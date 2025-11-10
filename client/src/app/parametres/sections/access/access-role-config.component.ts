import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SettingsService, AppSettings } from '../../../core/services/settings.service';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

type RoleId = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER';

interface HomeBlockDef {
  id: string;
  title: string;
  colorClass: string;
  submodules?: { id: string; label: string; description?: string; icon?: string; children?: { id: string; label: string }[] }[];
}

@Component({
  selector: 'app-access-role-config',
  templateUrl: './access-role-config.component.html',
  styleUrls: ['./access-role-config.component.css'],
  standalone: false
})
export class AccessRoleConfigComponent implements OnInit, OnDestroy {
  role!: RoleId;
  loading = false;
  saving = false;
  error = '';

  // Modal state
  showSubmodules = false;
  currentBlock: HomeBlockDef | null = null;
  showAccessChoice = false;
  pendingBlock: HomeBlockDef | null = null;
  isPendingAlreadyActive = false;
  playGlareFor: string | null = null;

  // Local working copy
  settings: AppSettings | null = null;

  // Legacy long-press removed to avoid tablet context menu

  blocks: HomeBlockDef[] = [
    { id: 'caisse', title: 'Caisse', colorClass: 'from-emerald-200 to-green-200' },
    { id: 'historique-ventes', title: 'Historique des Ventes', colorClass: 'from-slate-200 to-gray-200' },
    { id: 'historique-pointage', title: 'Historique Pointage', colorClass: 'from-slate-300 to-gray-300' },
    { id: 'cloture', title: 'Clôture', colorClass: 'from-rose-200 to-pink-200' },
    { id: 'stock', title: 'Stock', colorClass: 'from-orange-200 to-amber-200', submodules: [
      { id: 'stock-achat', label: 'Achat', description: "Créer un bon d'entrée ou un bon de retour", icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
      { id: 'stock-historique-docs', label: 'Historique des documents', description: 'Consulter les documents de stock', icon: 'M7 7h10M7 11h10M7 15h10' },
      { id: 'stock-reception', label: 'Réception Documents', description: 'Réceptionner les documents de stock', icon: 'M5 13l4 4L19 7' },
      { id: 'stock-parc', label: 'Gestion de parc', description: 'Véhicules et chauffeurs', icon: 'M20 7l-8-4-8 4m0 10h16' },
      { id: 'stock-gestion', label: 'Gestion de Stock', description: 'Gérer les produits et inventaires', icon: 'M4 6h16M6 10h12M8 14h8' },
      { id: 'stock-inventaire', label: 'Inventaire', description: "Faire l'inventaire du dépôt", icon: 'M12 6v12M6 12h12' },
      { id: 'stock-historique', label: 'Historique du stock', description: 'Archives et analyses des transactions de stock', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0' },
      { id: 'stock-ventes-livraisons', label: 'Ventes et Livraisons', description: 'Génération de ventes et livraisons', icon: 'M9 12l2 2 4-4' },
      { id: 'stock-produits-stock', label: 'Produits de Stock', description: 'Sous-produits de stock', icon: 'M6 6h12v12H6zM9 9h6v6H9z' },
      { id: 'stock-produits', label: 'Produits', description: 'Gestion des produits pâtisserie', icon: 'M8 8h8M6 12h12M10 16h4' },
      { id: 'stock-vente-gros', label: 'Produits en Gros', description: 'Fardeaux & marges', icon: 'M12 6l6 6-6 6-6-6 6-6z' },
      { id: 'stock-gros-config', label: 'Configuration Gros', description: 'Règles et tarifs en gros', icon: 'M3 7h18M3 12h18M3 17h18' }
    ]},
    { id: 'parametres', title: 'Paramètres', colorClass: 'from-yellow-200 to-amber-200', submodules: [
      { id: 'general', label: 'Paramètres Généraux', description: 'Configuration système et préférences' },
      { id: 'users', label: 'Gestion des Utilisateurs', description: 'Créer et gérer les comptes utilisateurs' },
      { id: 'access', label: 'Gestion des Accès', description: "Afficher/masquer les blocs d'accueil par rôle" },
      { id: 'enterprise', label: "Gestion d'Entreprise", description: 'Gérer les entreprises et leurs entrepôts' }
    ] },
    { id: 'rapports', title: 'Rapports', colorClass: 'from-blue-200 to-indigo-200', submodules: [
      { id: 'rapport-extrait-journalier', label: 'Extrait Journalière', description: 'Extraits 10 derniers jours détaillés', icon: 'M9 19v-6a2 2 0 00-2-2H5m0 0l7-7 7 7H17a2 2 0 00-2 2v6' },
      { id: 'rapport-journalier-mensuel', label: 'Rapport Journalier / Mensuel', description: 'CA, Achat, Résultat par période', icon: 'M7 7h10M7 11h10M7 15h10' },
      { id: 'rapport-vente-rubrique', label: 'Vente par Rubrique', description: 'Analyse ventes/achats par article ou famille', icon: 'M9 12h6m-6 4h6' },
      { id: 'rapport-vente-credit', label: 'Vente à Crédit', description: 'Suivi des ventes à crédit et dus', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2' },
      { id: 'rapport-finance', label: 'Finance', description: 'Relevés clients et fournisseurs', icon: 'M3 10h18M7 15h10' },
      { id: 'rapport-depense', label: 'État Dépense', description: 'Suivi dépenses et statuts', icon: 'M12 6v12M6 12h12' },
      { id: 'rapport-dashboard', label: 'Dashboard', description: 'Indicateurs clés', icon: 'M5 13l4 4L19 7' },
      { id: 'rapport-reconciliation', label: 'Réconciliation Inventaire & Ventes', description: 'Récap achats/ventes valorisés', icon: 'M12 8v4l3 3' },
      { id: 'rapport-mvt-stock', label: 'État MVT STOCK', description: 'Mouvements stock CUMP/détail', icon: 'M6 6h12v12H6z' }
    ]},
    { id: 'approvals', title: 'Centre d\'approbation', colorClass: 'from-purple-200 to-violet-200' },
    { id: 'charges', title: 'Dépenses', colorClass: 'from-red-200 to-rose-200', submodules: [
      { id: 'depenses-consulter', label: 'Consulter', description: 'Voir toutes', icon: 'M7 7h10M7 11h10M7 15h10' },
      { id: 'depenses-ajouter', label: 'Ajouter', description: 'Nouvelle', icon: 'M12 6v12M6 12h12' },
      { id: 'depenses-categorie', label: 'Catégorie', description: 'Nouvelle', icon: 'M6 6h12v12H6z' },
      { id: 'depenses-statistiques', label: 'Statistiques', description: 'Rapports', icon: 'M9 19v-6a2 2 0 00-2-2H5' }
    ]},
    { id: 'clients', title: 'Clients', colorClass: 'from-lime-200 to-green-200', submodules: [
      { id: 'clients-consulter', label: 'Consulter Clients', description: 'Voir la liste des clients', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0z' },
      { id: 'clients-ajouter', label: 'Ajouter Client', description: 'Créer un nouveau client', icon: 'M12 6v12M6 12h12' },
      { id: 'clients-releve', label: 'Relevé Client', description: 'Consulter relevés clients', icon: 'M7 7h10M7 11h10' },
      { id: 'clients-reglement', label: 'Règlement Client', description: 'Gérer règlements clients', icon: 'M3 10h18M7 15h1' }
    ]},
    { id: 'suppliers', title: 'Fournisseurs', colorClass: 'from-indigo-200 to-purple-200', submodules: [
      { id: 'fournisseurs-consulter', label: 'Consulter Fournisseurs', description: 'Voir la liste des fournisseurs', icon: 'M19 21V5a2 2 0 00-2-2H7' },
      { id: 'fournisseurs-ajouter', label: 'Ajouter Fournisseur', description: 'Créer un nouveau fournisseur', icon: 'M12 6v12M6 12h12' },
      { id: 'fournisseurs-releve', label: 'Relevé Fournisseur', description: 'Consulter relevés fournisseurs', icon: 'M7 7h10M7 11h10' },
      { id: 'fournisseurs-reglement', label: 'Règlement Fournisseur', description: 'Gérer règlements fournisseurs', icon: 'M3 10h18M7 15h1' }
    ]},
    { id: 'vente-tables', title: 'Vente Tables', colorClass: 'from-purple-200 to-pink-200' },
  ];

  // Reuse Home icons for visual consistency
  private moduleIcons: Record<string, string> = {
    caisse: 'M472 96c13.232 0 24-10.768 24-24V24c0-13.232-10.768-24-24-24H312c-13.232 0-24 10.768-24 24v48c0 13.232 10.768 24 24 24h48v240h-16V152c0-22.056-17.944-40-40-40H192V0H48v112h-8c-22.056 0-40 17.944-40 40v184v8v152h496V336h-72V96H472zM64 16h16v16h16V16h16v16h16V16h16v16h16V16h16v144H64V16zM16 152c0-13.232 10.768-24 24-24h8v32H32v16h176v-16h-16v-32h112c13.232 0 24 10.768 24 24v184H16V152zM480 352v128H16V352H480zM376 336V96h32v240H376zM312 80c-4.416 0-8-3.584-8-8V24c0-4.416 3.584-8 8-8h160c4.416 0 8 3.584 8 8v48c0 4.416-3.584 8-8 8H312z',
    'historique-ventes': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    'historique-pointage': 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    cloture: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    stock: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    parametres: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    rapports: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    approvals: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    charges: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    clients: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    suppliers: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    'vente-tables': 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
    'tables-salon': 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
    scanning: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
    'documents-reception': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    inventory: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    'reminders-admin': 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    enterprise: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
  };

  getBlockIcon(id: string): string {
    return this.moduleIcons[id] || 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
  }
  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private router: Router, private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.role = (this.route.snapshot.paramMap.get('role') as RoleId) || 'CASHIER';
    this.loadSettings();
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub.unsubscribe();
  }

  private loadSettings(): void {
    this.loading = true;
    this.sub = this.settingsService.getSettings().pipe(
      catchError(() => of(null as any))
    ).subscribe(s => {
      this.loading = false;
      if (s) {
        this.settings = s;
        const cfg = this.settings?.roleAccessConfig || {};
        if (!this.settings) return;
        this.settings.roleAccessConfig = cfg;
        if (!this.settings.roleAccessConfig[this.role]) {
          (this.settings.roleAccessConfig as any)[this.role] = { blocks: {} };
        }
      } else {
        this.error = 'Erreur chargement paramètres';
      }
    });
  }

  isBlockActive(blockId: string): boolean {
    const cfg = this.settings?.roleAccessConfig?.[this.role]?.blocks?.[blockId];
    if (!cfg) return false;
    if (cfg.visible === true) return true;
    const subs = cfg.submodules || {} as any;
    return Object.keys(subs).some(k => subs[k] === true);
  }

  toggleBlock(block: HomeBlockDef, forceVisible?: boolean): void {
    if (!this.settings) return;
    const roleCfg = this.settings.roleAccessConfig![this.role]!;
    const current = roleCfg.blocks[block.id] || { visible: false, submodules: {} } as any;
    const nextVisible = forceVisible !== undefined ? forceVisible : !current.visible;
    roleCfg.blocks[block.id] = { ...current, visible: nextVisible };
  }

  openSubmodules(block: HomeBlockDef): void {
    this.currentBlock = block;
    this.showSubmodules = true;
  }
  
  onTileClick(block: HomeBlockDef): void {
    const wasActive = this.isBlockActive(block.id);
    const hasSubs = !!(block.submodules && block.submodules.length > 0);

    // If active and no submodules -> instantly revoke
    if (wasActive && !hasSubs) {
      this.toggleBlock(block, false);
      return;
    }

    // If not active and no submodules -> grant instantly
    if (!wasActive && !hasSubs) {
      this.toggleBlock(block, true);
      this.triggerActivationFX(block.id);
      return;
    }

    // Otherwise show choice modal (grant/manage or revoke/manage)
    this.pendingBlock = block;
    this.isPendingAlreadyActive = wasActive;
    this.showAccessChoice = true;
  }

  grantFullModuleAccess(): void {
    if (!this.pendingBlock) return;
    this.toggleBlock(this.pendingBlock, true);
    // Optionally set all submodules on
    if (this.settings && this.pendingBlock.submodules?.length) {
      const roleCfg = this.settings.roleAccessConfig![this.role]!;
      const current = roleCfg.blocks[this.pendingBlock.id] || { visible: true, submodules: {} } as any;
      const subs: any = { ...(current.submodules || {}) };
      this.pendingBlock.submodules.forEach(sm => subs[sm.id] = true);
      roleCfg.blocks[this.pendingBlock.id] = { visible: true, submodules: subs };
    }
    this.triggerActivationFX(this.pendingBlock.id);
    this.closeAccessChoice();
  }

  openSubmodulesFromChoice(): void {
    if (!this.pendingBlock) return;
    this.openSubmodules(this.pendingBlock);
    this.closeAccessChoice();
  }

  closeAccessChoice(): void {
    this.showAccessChoice = false;
    this.pendingBlock = null;
    this.isPendingAlreadyActive = false;
  }

  pendingSubmodulesList(): string {
    const subs = this.pendingBlock?.submodules || [];
    if (!subs.length) return 'aucun sous-module';
    return subs.map(s => s.label).join(', ');
  }

  private triggerActivationFX(blockId: string): void {
    this.playGlareFor = blockId;
    setTimeout(() => {
      if (this.playGlareFor === blockId) this.playGlareFor = null;
    }, 650);
  }

  getBreathDelayMs(index: number): string {
    const base = (index % 7) * 120; // slight desync up to ~840ms
    return `${base}ms`;
  }

  toggleSub(blockId: string, subId: string): void {
    if (!this.settings) return;
    const roleCfg = this.settings.roleAccessConfig![this.role]!;
    const current = roleCfg.blocks[blockId] || { visible: false, submodules: {} };
    const next = { ...current, submodules: { ...(current.submodules || {}) } };
    next.submodules![subId] = !next.submodules?.[subId];
    // If any submodule is enabled, force parent visible and thus highlighted
    const anyOn = Object.values(next.submodules || {}).some(v => v === true);
    if (anyOn) {
      next.visible = true;
    }
    roleCfg.blocks[blockId] = next;
  }

  save(): void {
    if (!this.settings) return;
    this.saving = true;
    this.settingsService.updateSettings({ roleAccessConfig: this.settings.roleAccessConfig }).pipe(
      catchError(() => of(null as any))
    ).subscribe(res => {
      this.saving = false;
      if (!res) {
        this.error = 'Erreur enregistrement';
        return;
      }
      this.router.navigate(['/parametres/access']);
    });
  }

  closeModal(): void {
    this.showSubmodules = false;
    this.currentBlock = null;
  }
}


