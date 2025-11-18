# Scripts de Diagnostic

## check-sessions.js

Ce script permet de vérifier l'existence des sessions dans la base de données et de diagnostiquer les problèmes liés aux sessions.

### Utilisation

```bash
cd server
node src/scripts/check-sessions.js
```

### Ce que fait le script

1. Vérifie l'existence des sessions spécifiques qui causent des erreurs 404 (8, 13, 14, 16, 17, 18)
2. Affiche les informations détaillées de chaque session (depotId, status, user, depot)
3. Affiche les statistiques générales des sessions
4. Affiche la répartition des sessions par dépôt
5. Vérifie les Change Requests liées à ces sessions

### Résolution des problèmes

Si une session n'existe pas :
- La session a peut-être été supprimée de la base de données
- Le Change Request est orphelin et devrait être nettoyé

Si une session existe mais retourne 404 :
- Vérifier que le depotId de la session correspond au depotId utilisé dans la requête
- Vérifier que l'utilisateur a les permissions nécessaires pour accéder à cette session

