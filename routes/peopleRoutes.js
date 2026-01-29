const express = require("express");
const router = express.Router();
const peopleController = require("../controllers/peopleController");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

// All routes require authentication
router.use(authMiddleware);

// Get all people
router.get("/", peopleController.getAllPeople);

// Search people
router.get("/search", peopleController.searchPeople);

// Get person by ID
router.get("/:id", peopleController.getPersonById);
router.get("/details/:id", peopleController.getPersonDetails);

// Create a new person
router.post("/", requireRole("admin"), peopleController.createPerson);

// Add a sibling for an existing person
router.post("/:id/siblings", requireRole("admin"), peopleController.addSibling);

// Add a child for an existing person
router.post("/:id/children", requireRole("admin"), peopleController.addChild);

// Update a person
router.put("/:id", requireRole("admin"), peopleController.updatePerson);

// Delete a person
router.delete("/:id", requireRole("admin"), peopleController.deletePerson);

router.put("/save/:id", requireRole("admin"), peopleController.savePerson);

module.exports = router;
