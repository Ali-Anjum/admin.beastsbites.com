function hasRole(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}

function allowRoles(allowedRoles) {
  return function roleGuard(req, res, next) {
    const role = req.user?.role;

    if (!role || !hasRole(role, allowedRoles)) {
      return res.status(403).json({
        success: false,
        message: "Access denied."
      });
    }

    return next();
  };
}

module.exports = {
  allowRoles,
  hasRole
};
