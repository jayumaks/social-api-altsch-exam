const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Follow = require('../models/Follow');
const Like = require('../models/Like');
const { getPagination, buildMeta } = require('../utils/pagination');

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

function buildPostSearchFilter(query) {
  const filter = { state: 'published' };

  if (query.author) filter.__authorSearch = query.author.trim();
  if (query.title) filter.title = { $regex: query.title.trim(), $options: 'i' };
  if (query.tag) filter.tags = { $regex: query.tag.trim().toLowerCase(), $options: 'i' };
  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search.trim(), $options: 'i' } },
      { content: { $regex: query.search.trim(), $options: 'i' } },
      { tags: { $regex: query.search.trim().toLowerCase(), $options: 'i' } }
    ];
  }
  return filter;
}

async function resolveAuthorSearch(filter) {
  if (!filter.__authorSearch) return filter;
  const term = filter.__authorSearch;
  delete filter.__authorSearch;
  const users = await User.find({
    $or: [
      { username: { $regex: term, $options: 'i' } },
      { first_name: { $regex: term, $options: 'i' } },
      { last_name: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } }
    ]
  }).select('_id');
  filter.author = { $in: users.map((u) => u._id) };
  return filter;
}

async function listPublishedPosts(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const filter = await resolveAuthorSearch(buildPostSearchFilter(req.query));

  const allowedSorts = new Set(['like_count', 'comment_count', 'createdAt']);
  const requestedSort = req.query.sort?.replace(/^-/, '');
  const sortField = allowedSorts.has(requestedSort) ? requestedSort : 'createdAt';
  const direction = req.query.sort?.startsWith('-') ? -1 : 1;
  const sort = { [sortField]: direction, _id: -1 };

  const [total, posts] = await Promise.all([
    Post.countDocuments(filter),
    Post.find(filter)
      .populate('author', 'first_name last_name username email bio avatar_url createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limit)
  ]);

  res.json({ data: posts, meta: buildMeta(total, page, limit) });
}

async function getPost(req, res) {
  const post = await Post.findOne({ _id: req.params.id, state: 'published' })
    .populate('author', 'first_name last_name username email bio avatar_url createdAt');

  if (!post) return res.status(404).json({ message: 'Published post not found' });
  res.json({ post });
}

async function createPost(req, res) {
  const { title, content, tags } = req.body;
  const post = await Post.create({ title, content, tags: sanitizeTags(tags), author: req.user._id, state: 'draft' });
  await post.populate('author', 'first_name last_name username email bio avatar_url');
  res.status(201).json({ message: 'Post created as draft', post });
}

async function updatePost(req, res) {
  const post = await Post.findOne({ _id: req.params.id, author: req.user._id });
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const { title, content, tags } = req.body;
  if (title !== undefined) post.title = title;
  if (content !== undefined) post.content = content;
  if (tags !== undefined) post.tags = sanitizeTags(tags);
  await post.save();
  await post.populate('author', 'first_name last_name username email bio avatar_url');

  res.json({ message: 'Post updated', post });
}

async function updatePostState(req, res) {
  if (!['draft', 'published'].includes(req.body.state)) {
    return res.status(400).json({ message: 'state must be draft or published' });
  }

  const post = await Post.findOne({ _id: req.params.id, author: req.user._id });
  if (!post) return res.status(404).json({ message: 'Post not found' });

  post.state = req.body.state;
  await post.save();
  await post.populate('author', 'first_name last_name username email bio avatar_url');

  res.json({ message: `Post ${post.state}`, post });
}

async function deletePost(req, res) {
  const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.user._id });
  if (!post) return res.status(404).json({ message: 'Post not found' });

  await Like.deleteMany({ post: post._id });
  res.json({ message: 'Post deleted' });
}

async function likePost(req, res) {
  const post = await Post.findOne({ _id: req.params.id, state: 'published' });
  if (!post) return res.status(404).json({ message: 'Published post not found' });

  try {
    await Like.create({ user: req.user._id, post: post._id });
    post.like_count += 1;
    await post.save();
    return res.status(201).json({ message: 'Post liked', like_count: post.like_count });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'You already liked this post' });
    throw error;
  }
}

async function unlikePost(req, res) {
  const post = await Post.findOne({ _id: req.params.id, state: 'published' });
  if (!post) return res.status(404).json({ message: 'Published post not found' });

  const like = await Like.findOneAndDelete({ user: req.user._id, post: post._id });
  if (!like) return res.status(404).json({ message: 'You have not liked this post' });

  post.like_count = Math.max(0, post.like_count - 1);
  await post.save();
  res.json({ message: 'Post unliked', like_count: post.like_count });
}

async function getFeed(req, res) {
  const { page, limit, skip } = getPagination(req.query, 20, 100);
  const follows = await Follow.find({ follower: req.user._id }).select('following');
  const authors = follows.map((f) => f.following);
  authors.push(req.user._id);

  const filter = { state: 'published', author: { $in: authors } };
  const [total, posts] = await Promise.all([
    Post.countDocuments(filter),
    Post.find(filter).populate('author', 'first_name last_name username email bio avatar_url').sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  res.json({ data: posts, meta: buildMeta(total, page, limit) });
}

module.exports = { listPublishedPosts, getPost, createPost, updatePost, updatePostState, deletePost, likePost, unlikePost, getFeed };
