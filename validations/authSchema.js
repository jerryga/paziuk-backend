const Joi = require("joi");

const signupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address.",
    "any.required": "Email is required.",
  }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
  }),
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long.",
  }),
});

module.exports = { signupSchema, loginSchema };
