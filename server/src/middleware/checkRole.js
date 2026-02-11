// Middleware to check user roles
function checkRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Non authentifié'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Accès refusé. Droits insuffisants.',
                message: 'Vous devez être administrateur ou manager pour accéder à cette fonctionnalité.'
            });
        }

        next();
    };
}

module.exports = { checkRole };
