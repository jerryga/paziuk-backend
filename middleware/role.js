// Check if user has a required role
const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.user.role !== role)
    return res
      .status(403)
      .json({ error: "Forbidden: Insufficient privileges" });
  next();
};

module.exports = { requireRole };
