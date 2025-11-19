const express = require("express");
const router = express.Router();
const peopleController = require("../controllers/peopleController");
const authMiddleware = require("../middleware/auth");

// All routes require authentication
router.use(authMiddleware);

// Get all people
router.get("/", peopleController.getAllPeople);

// Search people
router.get("/search", peopleController.searchPeople);

// Get person by ID
router.get("/:id", peopleController.getPersonById);

// Create a new person
router.post("/", peopleController.createPerson);

// Update a person
router.put("/:id", peopleController.updatePerson);

// Delete a person
router.delete("/:id", peopleController.deletePerson);

router.get("/details/:id", peopleController.getPersonDetails);

router.put("/:id/story", peopleController.savePersonStory);

module.exports = router;
