export interface NavigationItem {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  color: string;
  gradient: string;
}

export const navigationItems: NavigationItem[] = [
  {
    id: 'caisse',
    title: 'Caisse',
    description: 'Point de vente',
    route: '/caisse',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01',
    color: 'from-green-400 to-green-600',
    gradient: 'from-green-100 to-green-200'
  },
  {
    id: 'historique',
    title: 'Historique',
    description: 'Transactions',
    route: '/historique',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'from-blue-400 to-blue-600',
    gradient: 'from-blue-100 to-blue-200'
  },
  {
    id: 'cloture',
    title: 'Clôture',
    description: 'Fin de journée',
    route: '/cloture',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'from-purple-400 to-purple-600',
    gradient: 'from-purple-100 to-purple-200'
  },
  {
    id: 'stock',
    title: 'Stock',
    description: 'Inventaire',
    route: '/stock',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    color: 'from-orange-400 to-orange-600',
    gradient: 'from-orange-100 to-orange-200'
  },
  {
    id: 'parametres',
    title: 'Paramètres',
    description: 'Configuration',
    route: '/parametres',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    color: 'from-gray-400 to-gray-600',
    gradient: 'from-gray-100 to-gray-200'
  },
  {
    id: 'rapports',
    title: 'Rapports',
    description: 'Analyses',
    route: '/rapports',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'from-teal-400 to-teal-600',
    gradient: 'from-teal-100 to-teal-200'
  },
  {
    id: 'approvals',
    title: 'Approvals',
    description: 'Validations',
    route: '/approvals',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: 'from-pink-400 to-pink-600',
    gradient: 'from-pink-100 to-pink-200'
  },
  {
    id: 'charges',
    title: 'Charges',
    description: 'Dépenses',
    route: '/charges',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'from-red-400 to-red-600',
    gradient: 'from-red-100 to-red-200'
  },
  {
    id: 'clients',
    title: 'Clients',
    description: 'Gestion clients',
    route: '/clients',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    color: 'from-indigo-400 to-indigo-600',
    gradient: 'from-indigo-100 to-indigo-200'
  }
]; 