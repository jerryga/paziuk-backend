const Joi = require("joi");

// Define the complex password regex as a constant for reuse
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/;

const signupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address.",
    "any.required": "Email is required.",
  }),
  password: Joi.string()
    .min(8)
    .max(20)
    .pattern(passwordRegex)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long.",
      "string.max": "Password must be at most 20 characters long.",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
      "any.required": "Password is required.",
    }),
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .max(20)
    .pattern(passwordRegex)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long.",
      "string.max": "Password must be at most 20 characters long.",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
      "any.required": "Password is required.",
    }),
});

module.exports = { signupSchema, loginSchema };
