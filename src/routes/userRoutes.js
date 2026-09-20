const express = require('express');
const { param } = require('express-validator');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getMe, followUser, unfollowUser, getFollowing, getFollowers, getOwnPosts } = require('../controllers/userController');

const router = express.Router();
router.use(protect);

router.get('/me', getMe);
router.get('/me/following', getFollowing);
router.get('/me/followers', getFollowers);
router.get('/me/posts', getOwnPosts);
router.post('/:id/follow', [param('id').isMongoId()], validate, followUser);
router.delete('/:id/follow', [param('id').isMongoId()], validate, unfollowUser);

module.exports = router;
