const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  refresh,
  resetPassword,
} = require("../controllers/authController");

const rateLimit = require("express-rate-limit");

// Define the rate limiter for password resets
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per `window`
  message: {
    error:
      "Too many password reset requests. Please try again after 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/reset-password", resetPasswordLimiter, resetPassword);

module.exports = router;
