const express = require("express");
const router = express.Router();

const messageController = require("../controllers/messageController");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);
router.post("/", messageController.createMessage);
router.get("/", messageController.getMessages);
router.get("/person/:personId", messageController.getMessageByPersonId);
router.delete("/:id", messageController.deleteMessage);

module.exports = router;
