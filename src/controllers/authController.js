const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');

async function signup(req, res) {
  const { first_name, last_name, username, email, password, bio, avatar_url } = req.body;

  const existing = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
  if (existing) return res.status(409).json({ message: 'Username or email already in use' });

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({ first_name, last_name, username, email, password: hashedPassword, bio, avatar_url });
  const token = signToken(user._id);

  res.status(201).json({ message: 'Account created', token, user: user.toSafeJSON() });
}

async function signin(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = signToken(user._id);
  res.json({ message: 'Signed in successfully', token, user: user.toSafeJSON() });
}

module.exports = { signup, signin };
