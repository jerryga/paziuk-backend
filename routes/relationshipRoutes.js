const express = require("express");
const router = express.Router();
const relationshipController = require("../controllers/relationshipController");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

// All routes require authentication
// router.use(authMiddleware);

router.get("/", relationshipController.getAllFamilyTrees);
// Get all relationships
router.get("/:family_tree_id", relationshipController.getAllRelationships);

// Update a relationship
router.put(
  "/:id",
  requireRole("admin"),
  relationshipController.updateRelationship,
);

// Delete a relationship
router.delete(
  "/:id",
  requireRole("admin"),
  relationshipController.deleteRelationship,
);

module.exports = router;
