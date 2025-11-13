const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getProfile,
} = require("../controllers/userController");

router.use(authMiddleware);

// Admin-only routes
router.get("/", requireRole("admin"), getUsers);
router.post("/", requireRole("admin"), createUser);
router.delete("/:id", requireRole("admin"), deleteUser);

// Users can update their own profile
router.put("/:id", async (req, res) => {
  if (req.user.role === "admin" || req.user.id === req.params.id) {
    return updateUser(req, res);
  }
  return res
    .status(403)
    .json({ error: "Forbidden: cannot update other users" });
});

// Current user profile
router.get("/profile", getProfile);

module.exports = router;
