const express = require('express');
const { body } = require('express-validator');
const { signup, signin } = require('../controllers/authController');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/signup',
  [
    body('first_name').trim().notEmpty().isLength({ max: 80 }),
    body('last_name').trim().notEmpty().isLength({ max: 80 }),
    body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 })
  ],
  validate,
  signup
);

router.post('/signin', [body('email').isEmail().normalizeEmail(), body('password').notEmpty()], validate, signin);

module.exports = router;
