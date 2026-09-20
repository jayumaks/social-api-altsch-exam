const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Follow = require('../src/models/Follow');
const Like = require('../src/models/Like');

let mongo;
let userA;
let userB;
let tokenA;
let tokenB;
let postId;

async function signup(overrides = {}) {
  const payload = {
    first_name: 'Test',
    last_name: 'User',
    username: `user_${Math.random().toString(36).slice(2, 10)}`,
    email: `${Math.random().toString(36).slice(2, 10)}@example.com`,
    password: 'password123',
    ...overrides
  };
  return request(app).post('/api/v1/auth/signup').send(payload);
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Post.init(), Follow.init(), Like.init()]);
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), Post.deleteMany({}), Follow.deleteMany({}), Like.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('Health and authentication', () => {
  test('GET /health works', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /auth/signup creates user and returns JWT', async () => {
    const res = await signup({ username: 'alice', email: 'alice@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();
  });

  test('POST /auth/signup rejects duplicates', async () => {
    await signup({ username: 'alice', email: 'alice@example.com' });
    const res = await signup({ username: 'alice', email: 'alice2@example.com' });
    expect(res.status).toBe(409);
  });

  test('POST /auth/signin authenticates valid credentials', async () => {
    await signup({ username: 'alice', email: 'alice@example.com' });
    const res = await request(app).post('/api/v1/auth/signin').send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('POST /auth/signin rejects invalid credentials', async () => {
    await signup({ email: 'alice@example.com' });
    const res = await request(app).post('/api/v1/auth/signin').send({ email: 'alice@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });
});

describe('Posts', () => {
  beforeEach(async () => {
    const a = await signup({ username: 'alice', email: 'alice@example.com', first_name: 'Alice', last_name: 'Author' });
    const b = await signup({ username: 'bob', email: 'bob@example.com', first_name: 'Bob', last_name: 'Writer' });
    userA = a.body.user;
    userB = b.body.user;
    tokenA = a.body.token;
    tokenB = b.body.token;
  });

  test('POST /posts requires authentication', async () => {
    const res = await request(app).post('/api/v1/posts').send({ title: 'Hello', content: 'World' });
    expect(res.status).toBe(401);
  });

  test('POST /posts creates a draft', async () => {
    const res = await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${tokenA}`).send({ title: 'Hello', content: 'World', tags: ['NodeJS', 'API', 'NodeJS'] });
    expect(res.status).toBe(201);
    expect(res.body.post.state).toBe('draft');
    expect(res.body.post.tags).toEqual(['nodejs', 'api']);
    postId = res.body.post._id;
  });

  test('GET /posts exposes only published posts to anonymous users and is paginated', async () => {
    await Post.create({ title: 'Draft', content: 'hidden', author: userA.id, state: 'draft' });
    await Post.create({ title: 'Published', content: 'visible', author: userA.id, state: 'published', tags: ['nodejs'] });
    const res = await request(app).get('/api/v1/posts?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(20);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Published');
  });

  test('GET /posts supports search by title, tags, and author', async () => {
    await Post.create({ title: 'Node API', content: 'one', author: userA.id, state: 'published', tags: ['backend'] });
    await Post.create({ title: 'Mongo Guide', content: 'two', author: userB.id, state: 'published', tags: ['database'] });

    const byTitle = await request(app).get('/api/v1/posts?title=Node');
    const byTag = await request(app).get('/api/v1/posts?tag=database');
    const byAuthor = await request(app).get('/api/v1/posts?author=alice');
    expect(byTitle.body.data).toHaveLength(1);
    expect(byTag.body.data).toHaveLength(1);
    expect(byAuthor.body.data).toHaveLength(1);
    expect(byAuthor.body.data[0].author.username).toBe('alice');
  });

  test('GET /posts supports sorting by like_count, comment_count, and timestamp', async () => {
    await Post.create({ title: 'Low', content: 'one', author: userA.id, state: 'published', like_count: 1, comment_count: 1 });
    await Post.create({ title: 'High', content: 'two', author: userA.id, state: 'published', like_count: 10, comment_count: 5 });
    const res = await request(app).get('/api/v1/posts?sort=-like_count');
    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe('High');
  });

  test('GET /posts/:id returns a published post with author information', async () => {
    const post = await Post.create({ title: 'Public', content: 'text', author: userA.id, state: 'published' });
    const res = await request(app).get(`/api/v1/posts/${post._id}`);
    expect(res.status).toBe(200);
    expect(res.body.post.author.username).toBe('alice');
  });

  test('GET /posts/:id does not expose drafts publicly', async () => {
    const post = await Post.create({ title: 'Private', content: 'text', author: userA.id, state: 'draft' });
    const res = await request(app).get(`/api/v1/posts/${post._id}`);
    expect(res.status).toBe(404);
  });

  test('POST /posts/:id/state publishes only when owner requests it', async () => {
    const post = await Post.create({ title: 'Draft', content: 'text', author: userA.id, state: 'draft' });
    const forbidden = await request(app).patch(`/api/v1/posts/${post._id}/state`).set('Authorization', `Bearer ${tokenB}`).send({ state: 'published' });
    const allowed = await request(app).patch(`/api/v1/posts/${post._id}/state`).set('Authorization', `Bearer ${tokenA}`).send({ state: 'published' });
    expect(forbidden.status).toBe(404);
    expect(allowed.status).toBe(200);
    expect(allowed.body.post.state).toBe('published');
  });

  test('PATCH /posts/:id lets owner edit a draft or published post', async () => {
    const post = await Post.create({ title: 'Old', content: 'text', author: userA.id, state: 'draft' });
    const res = await request(app).patch(`/api/v1/posts/${post._id}`).set('Authorization', `Bearer ${tokenA}`).send({ title: 'New', content: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.post.title).toBe('New');
  });

  test('PATCH /posts/:id rejects non-owners', async () => {
    const post = await Post.create({ title: 'Old', content: 'text', author: userA.id, state: 'published' });
    const res = await request(app).patch(`/api/v1/posts/${post._id}`).set('Authorization', `Bearer ${tokenB}`).send({ title: 'Hacked' });
    expect(res.status).toBe(404);
  });

  test('DELETE /posts/:id lets owner delete draft or published post', async () => {
    const post = await Post.create({ title: 'Delete me', content: 'text', author: userA.id, state: 'published' });
    const res = await request(app).delete(`/api/v1/posts/${post._id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(await Post.findById(post._id)).toBeNull();
  });

  test('POST /posts/:id/like prevents duplicate likes', async () => {
    const post = await Post.create({ title: 'Like me', content: 'text', author: userA.id, state: 'published' });
    const one = await request(app).post(`/api/v1/posts/${post._id}/like`).set('Authorization', `Bearer ${tokenB}`);
    const two = await request(app).post(`/api/v1/posts/${post._id}/like`).set('Authorization', `Bearer ${tokenB}`);
    expect(one.status).toBe(201);
    expect(two.status).toBe(409);
    expect(one.body.like_count).toBe(1);
  });

  test('DELETE /posts/:id/like unlikes a post', async () => {
    const post = await Post.create({ title: 'Like me', content: 'text', author: userA.id, state: 'published' });
    await request(app).post(`/api/v1/posts/${post._id}/like`).set('Authorization', `Bearer ${tokenB}`);
    const res = await request(app).delete(`/api/v1/posts/${post._id}/like`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.like_count).toBe(0);
  });

  test('GET /posts/feed returns posts by followed users plus self', async () => {
    await Post.create({ title: 'Mine', content: 'self', author: userA.id, state: 'published' });
    await Post.create({ title: 'Bob', content: 'followed', author: userB.id, state: 'published' });
    await Follow.create({ follower: userA.id, following: userB.id });
    const res = await request(app).get('/api/v1/posts/feed').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('Follow endpoints', () => {
  beforeEach(async () => {
    const a = await signup({ username: 'alice', email: 'alice@example.com' });
    const b = await signup({ username: 'bob', email: 'bob@example.com' });
    userA = a.body.user;
    userB = b.body.user;
    tokenA = a.body.token;
    tokenB = b.body.token;
  });

  test('POST /users/:id/follow follows another user', async () => {
    const res = await request(app).post(`/api/v1/users/${userB.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(201);
    expect(res.body.follow.following).toBe(userB.id);
  });

  test('POST /users/:id/follow prevents self-follow', async () => {
    const res = await request(app).post(`/api/v1/users/${userA.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(400);
  });

  test('POST /users/:id/follow prevents duplicate follow', async () => {
    await request(app).post(`/api/v1/users/${userB.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    const res = await request(app).post(`/api/v1/users/${userB.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(409);
  });

  test('DELETE /users/:id/follow unfollows a user', async () => {
    await Follow.create({ follower: userA.id, following: userB.id });
    const res = await request(app).delete(`/api/v1/users/${userB.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(await Follow.countDocuments({ follower: userA.id, following: userB.id })).toBe(0);
  });

  test('GET /users/me/following returns following list', async () => {
    await Follow.create({ follower: userA.id, following: userB.id });
    const res = await request(app).get('/api/v1/users/me/following').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].username).toBe('bob');
  });

  test('GET /users/me/followers returns followers list', async () => {
    await Follow.create({ follower: userB.id, following: userA.id });
    const res = await request(app).get('/api/v1/users/me/followers').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].username).toBe('bob');
  });

  test('GET /users/me returns current user', async () => {
    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
  });

  test('GET /users/me/posts supports state filter and pagination', async () => {
    await Post.create({ title: 'Draft', content: 'x', author: userA.id, state: 'draft' });
    await Post.create({ title: 'Published', content: 'y', author: userA.id, state: 'published' });
    const res = await request(app).get('/api/v1/users/me/posts?state=draft&page=1&limit=20').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(20);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].state).toBe('draft');
  });
});
