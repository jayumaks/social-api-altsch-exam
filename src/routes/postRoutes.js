const express = require('express');
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { listPublishedPosts, getPost, createPost, updatePost, updatePostState, deletePost, likePost, unlikePost, getFeed } = require('../controllers/postController');

const router = express.Router();

router.get('/', listPublishedPosts);
router.get('/feed', protect, getFeed);
router.get('/:id', [param('id').isMongoId()], validate, getPost);

router.post(
  '/',
  protect,
  [body('title').trim().notEmpty().isLength({ max: 200 }), body('content').trim().notEmpty(), body('tags').optional().isArray()],
  validate,
  createPost
);

router.patch('/:id', protect, [param('id').isMongoId()], validate, updatePost);
router.patch('/:id/state', protect, [param('id').isMongoId(), body('state').isIn(['draft', 'published'])], validate, updatePostState);
router.delete('/:id', protect, [param('id').isMongoId()], validate, deletePost);
router.post('/:id/like', protect, [param('id').isMongoId()], validate, likePost);
router.delete('/:id/like', protect, [param('id').isMongoId()], validate, unlikePost);

module.exports = router;
