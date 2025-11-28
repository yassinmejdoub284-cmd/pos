# Migration du Système de Transfert VRAC

## Vue d'ensemble

Cette migration transforme le système de transfert VRAC d'un modèle dénormalisé (ratios stockés sur chaque produit destinataire) vers une architecture propre avec une table dédiée `ProductVracConversion`.

## Changements majeurs

### 1. Nouveau modèle de données

**Table `product_vrac_conversions`**
- `id`: Identifiant unique
- `sourceProductId`: ID du produit source
- `targetProductId`: ID du produit destinataire VRAC
- `conversionRatio`: Ratio de conversion (1 source = X destinataires)
- `prix_vente_vrac`: Prix de vente VRAC (optionnel)
- `prix_achat_vrac`: Prix d'achat VRAC (optionnel)
- `isStockable`: Indique si le produit destinataire est gérable en stock
- Contrainte unique: `(sourceProductId, targetProductId)`

### 2. Nouveaux endpoints API

- `GET /products/vrac-conversions/:sourceProductId` - Récupère toutes les conversions VRAC d'un produit source
- `POST /products/vrac-conversions` - Crée ou met à jour des conversions VRAC
- `DELETE /products/vrac-conversions/:id` - Supprime une conversion VRAC

### 3. Fonctionnalité de transfert améliorée

- **Avant**: Transfert vers un seul produit destinataire à la fois
- **Après**: Transfert automatique vers tous les produits destinataires configurés en une seule opération

## Instructions de migration

### Étape 1: Appliquer le schéma Prisma

```bash
cd server
npx prisma db push
```

### Étape 2: Migrer les données existantes

Exécuter le script de migration pour transférer les données de l'ancien système vers le nouveau:

```bash
cd server
node src/scripts/migrate-vrac-conversions.js
```

Ce script:
- Trouve tous les produits avec `originalProductId` et `conversionRatio`
- Crée les entrées correspondantes dans `product_vrac_conversions`
- Met à jour `isVraguable` sur les produits sources

### Étape 3: Vérifier la migration

```sql
-- Vérifier le nombre de conversions migrées
SELECT COUNT(*) FROM product_vrac_conversions;

-- Vérifier les produits sources avec conversions
SELECT p.id, p.name, COUNT(c.id) as conversion_count
FROM products p
LEFT JOIN product_vrac_conversions c ON p.id = c.source_product_id
WHERE p.is_vraguable = true
GROUP BY p.id, p.name;
```

### Étape 4: Redémarrer le serveur

```bash
cd server
npm start
```

## Vérifications post-déploiement

### 1. Vérifier les endpoints

```bash
# Récupérer les conversions d'un produit source
curl -X GET http://localhost:3000/products/vrac-conversions/123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Créer des conversions
curl -X POST http://localhost:3000/products/vrac-conversions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceProductId": 123,
    "conversions": [
      {
        "targetProductId": 456,
        "conversionRatio": 20,
        "prix_vente_vrac": 2.5,
        "isStockable": true
      }
    ]
  }'
```

### 2. Tester le transfert multi-produits

1. Aller sur `/stock/produits`
2. Configurer un produit comme "Convertible en VRAC" avec plusieurs destinataires
3. Aller sur `/stock/transfer-vers-vrag`
4. Sélectionner le produit source
5. Vérifier que tous les destinataires s'affichent avec leurs ratios
6. Saisir une quantité source
7. Vérifier que les quantités destinataires sont calculées automatiquement
8. Effectuer le transfert
9. Vérifier que le stock source est décrémenté et les stocks destinataires incrémentés

### 3. Vérifier les mouvements de stock

```sql
-- Vérifier les mouvements de transfert récents
SELECT 
  sm.id,
  sm.date,
  sm.type,
  sm.quantity,
  sm.reference,
  p.name as product_name
FROM stock_movements sm
JOIN products p ON sm.product_id = p.id
WHERE sm.reason = 'PRODUCT_CONVERSION'
ORDER BY sm.date DESC
LIMIT 20;
```

## Rétrocompatibilité

### Champs conservés (pour compatibilité)

Les champs suivants restent dans la table `products` mais ne sont plus utilisés pour la logique VRAC:
- `originalProductId` - Conservé pour compatibilité avec l'ancien système
- `conversionRatio` - Conservé mais non utilisé pour les nouveaux transferts
- `isVraguable` - Toujours utilisé pour identifier les produits convertibles

### Migration progressive

L'ancien système continue de fonctionner pendant la transition. Les nouvelles configurations utilisent la nouvelle table, tandis que les anciennes configurations peuvent être migrées progressivement.

## Rollback (si nécessaire)

Si vous devez revenir à l'ancien système:

1. **Ne pas supprimer la table** `product_vrac_conversions` (garder les données)
2. Les anciens champs `originalProductId` et `conversionRatio` sont toujours présents
3. Modifier le code frontend pour utiliser l'ancienne logique si nécessaire

## Notes importantes

- **Transaction atomique**: Tous les transferts vers plusieurs produits sont effectués dans une seule transaction Prisma
- **Validation stricte**: Les ratios et quantités sont validés avant le transfert
- **Audit complet**: Tous les transferts sont enregistrés dans les logs d'audit
- **Mouvements de stock**: Chaque transfert crée des entrées dans `stock_movements` pour traçabilité

## Support

En cas de problème lors de la migration:
1. Vérifier les logs du serveur
2. Vérifier les contraintes de base de données
3. Vérifier que tous les produits référencés existent
4. Vérifier les permissions utilisateur

