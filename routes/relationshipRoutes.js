const express = require("express");
const router = express.Router();
const relationshipController = require("../controllers/relationshipController");
const authMiddleware = require("../middleware/auth");

// All routes require authentication
router.use(authMiddleware);

// Get all relationships
router.get("/", relationshipController.getAllRelationships);

// Get relationships for a specific person (both as parent and child)
router.get(
  "/person/:personId",
  relationshipController.getRelationshipsByPerson
);

// Get relationships where person is parent
router.get(
  "/parent/:parentId",
  relationshipController.getRelationshipsByParent
);

// Get relationships where person is child
router.get("/child/:childId", relationshipController.getRelationshipsByChild);

// Create a new relationship
router.post("/", relationshipController.createRelationship);

// Update a relationship
router.put("/:id", relationshipController.updateRelationship);

// Delete a relationship
router.delete("/:id", relationshipController.deleteRelationship);

module.exports = router;
