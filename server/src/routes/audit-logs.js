const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

// GET /api/audit-logs/users/list - Récupérer la liste des utilisateurs pour le filtre
// IMPORTANT: Cette route doit être AVANT /:id pour éviter que "users" soit interprété comme un ID
router.get('/users/list', authenticateToken, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true
            },
            where: {
                isActive: true
            },
            orderBy: {
                firstName: 'asc'
            }
        });

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('Error fetching users list:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération de la liste des utilisateurs',
            message: error.message
        });
    }
});

// GET /api/audit-logs/stats/daily - Récupérer les statistiques du jour
// IMPORTANT: Cette route doit être AVANT /:id pour éviter que "stats" soit interprété comme un ID
router.get('/stats/daily', authenticateToken, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const logs = await prisma.auditLog.findMany({
            where: {
                createdAt: {
                    gte: today,
                    lt: tomorrow
                }
            },
            select: {
                action: true,
                tableName: true,
                userId: true,
                newValues: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        // Calculer les statistiques
        const stats = {
            totalActions: logs.length,
            creates: logs.filter(l => l.action === 'CREATE').length,
            updates: logs.filter(l => l.action === 'UPDATE').length,
            deletes: logs.filter(l => l.action === 'DELETE').length,
            criticalActions: 0,
            mostActiveUser: '',
            actionsByTable: {}
        };

        // Compter les actions par utilisateur
        const userCounts = {};
        logs.forEach(log => {
            const userName = `${log.user.firstName} ${log.user.lastName}`;
            userCounts[userName] = (userCounts[userName] || 0) + 1;

            // Compter par table
            stats.actionsByTable[log.tableName] = (stats.actionsByTable[log.tableName] || 0) + 1;

            // Détecter les actions critiques
            if (log.action === 'DELETE' && ['users', 'ventes', 'session_caisse'].includes(log.tableName)) {
                stats.criticalActions++;
            }

            // Détecter les grosses sommes
            try {
                if (log.newValues) {
                    const values = JSON.parse(log.newValues);
                    if (values.amount && parseFloat(values.amount) > 1000) {
                        stats.criticalActions++;
                    }
                }
            } catch (e) {
                // Ignorer les erreurs de parsing
            }
        });

        // Trouver l'utilisateur le plus actif
        if (Object.keys(userCounts).length > 0) {
            stats.mostActiveUser = Object.entries(userCounts)
                .sort((a, b) => b[1] - a[1])[0][0];
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error fetching daily stats:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des statistiques',
            message: error.message
        });
    }
});

// GET /api/audit-logs - Récupérer les logs d'audit avec filtres
router.get('/', authenticateToken, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            userId,
            tableName,
            action,
            search,
            page = 1,
            limit = 20
        } = req.query;

        // Validation de la pagination
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 par page
        const skip = (pageNum - 1) * limitNum;

        // Construction des filtres
        const where = {};

        // Filtre par date
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999); // Fin de journée
                where.createdAt.lte = endDateTime;
            }
        }

        // Filtre par utilisateur
        if (userId) {
            where.userId = parseInt(userId);
        }

        // Filtre par table
        if (tableName && tableName !== 'all') {
            where.tableName = tableName;
        }

        // Filtre par action
        if (action && action !== 'all') {
            where.action = action.toUpperCase();
        }

        // Recherche texte libre dans les valeurs JSON
        if (search) {
            where.OR = [
                { oldValues: { contains: search } },
                { newValues: { contains: search } }
            ];
        }

        // Récupération des logs avec optimisation (SELECT spécifique)
        const [logs, totalCount] = await Promise.all([
            prisma.auditLog.findMany({
                select: {
                    id: true,
                    tableName: true,
                    recordId: true,
                    action: true,
                    createdAt: true,
                    ipAddress: true,
                    userAgent: true,
                    // Ne pas charger old_values/new_values dans la liste (optimisation)
                    // Ils seront chargés uniquement au clic sur détails
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            role: true
                        }
                    }
                },
                where,
                orderBy: { createdAt: 'desc' },
                take: limitNum,
                skip
            }),
            prisma.auditLog.count({ where })
        ]);

        // Calcul des métadonnées de pagination
        const totalPages = Math.ceil(totalCount / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.json({
            success: true,
            data: logs,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalCount,
                limit: limitNum,
                hasNextPage,
                hasPrevPage
            }
        });

    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des logs d\'audit',
            message: error.message
        });
    }
});

// GET /api/audit-logs/:id - Récupérer les détails d'un log spécifique
// IMPORTANT: Cette route doit être APRÈS les routes spécifiques (/users/list, /stats/daily)
router.get('/:id', authenticateToken, checkRole(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const { id } = req.params;

        const log = await prisma.auditLog.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                tableName: true,
                recordId: true,
                action: true,
                oldValues: true, // Charger les JSON complets pour les détails
                newValues: true,
                createdAt: true,
                ipAddress: true,
                userAgent: true,
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true
                    }
                }
            }
        });

        if (!log) {
            return res.status(404).json({
                success: false,
                error: 'Log d\'audit non trouvé'
            });
        }

        // Parser les JSON de manière sécurisée
        let oldValues = null;
        let newValues = null;

        try {
            if (log.oldValues) {
                oldValues = JSON.parse(log.oldValues);
            }
        } catch (e) {
            console.error('Error parsing oldValues:', e);
            oldValues = { error: 'Données corrompues' };
        }

        try {
            if (log.newValues) {
                newValues = JSON.parse(log.newValues);
            }
        } catch (e) {
            console.error('Error parsing newValues:', e);
            newValues = { error: 'Données corrompues' };
        }

        res.json({
            success: true,
            data: {
                ...log,
                oldValues,
                newValues
            }
        });

    } catch (error) {
        console.error('Error fetching audit log details:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des détails du log',
            message: error.message
        });
    }
});

module.exports = router;
