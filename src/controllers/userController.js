const User = require('../models/User');
const Follow = require('../models/Follow');
const Post = require('../models/Post');
const { getPagination, buildMeta } = require('../utils/pagination');

async function getMe(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

async function followUser(req, res) {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (req.user._id.equals(target._id)) return res.status(400).json({ message: 'You cannot follow yourself' });

  try {
    const follow = await Follow.create({ follower: req.user._id, following: target._id });
    res.status(201).json({ message: 'User followed', follow });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'You already follow this user' });
    throw error;
  }
}

async function unfollowUser(req, res) {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });

  const result = await Follow.findOneAndDelete({ follower: req.user._id, following: target._id });
  if (!result) return res.status(404).json({ message: 'You are not following this user' });
  res.json({ message: 'User unfollowed' });
}

async function getFollowing(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { follower: req.user._id };
  const [total, rows] = await Promise.all([
    Follow.countDocuments(filter),
    Follow.find(filter).populate('following', 'first_name last_name username email bio avatar_url createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  res.json({ data: rows.map((r) => r.following), meta: buildMeta(total, page, limit) });
}

async function getFollowers(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { following: req.user._id };
  const [total, rows] = await Promise.all([
    Follow.countDocuments(filter),
    Follow.find(filter).populate('follower', 'first_name last_name username email bio avatar_url createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  res.json({ data: rows.map((r) => r.follower), meta: buildMeta(total, page, limit) });
}

async function getOwnPosts(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { author: req.user._id };

  if (req.query.state) {
    if (!['draft', 'published'].includes(req.query.state)) {
      return res.status(400).json({ message: 'state must be draft or published' });
    }
    filter.state = req.query.state;
  }

  const sortField = ['like_count', 'comment_count', 'createdAt', 'updatedAt'].includes(req.query.sort?.replace(/^-/, ''))
    ? req.query.sort.replace(/^-/, '')
    : 'createdAt';
  const sortDirection = req.query.sort?.startsWith('-') ? -1 : 1;
  const sort = { [sortField]: sortDirection };

  const [total, posts] = await Promise.all([
    Post.countDocuments(filter),
    Post.find(filter).populate('author', 'first_name last_name username email bio avatar_url').sort(sort).skip(skip).limit(limit)
  ]);

  res.json({ data: posts, meta: buildMeta(total, page, limit) });
}

module.exports = { getMe, followUser, unfollowUser, getFollowing, getFollowers, getOwnPosts };
