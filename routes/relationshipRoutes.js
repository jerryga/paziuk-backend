const express = require("express");
const router = express.Router();
const relationshipController = require("../controllers/relationshipController");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

// Note: GET routes are public to allow viewing family trees without authentication
// Mutation routes (PUT, DELETE) are protected with requireRole("admin")
// If you need to restrict viewing to authenticated users only, uncomment the line below:
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
