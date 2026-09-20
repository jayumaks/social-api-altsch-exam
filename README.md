# Social App API

A RESTful social media API built with Node.js, Express, MongoDB/Mongoose and JWT authentication.

## Requirements covered

- User signup/signin
- JWT authentication with 1-hour expiry
- Draft/published posts
- Public published post feed
- Authenticated post creation/edit/delete/publish
- Pagination, filtering, searching and sorting
- Author details on single-post responses
- Follow/unfollow users
- Followers/following lists
- Likes/unlikes with duplicate protection
- Automated endpoint tests with Jest + Supertest + MongoDB Memory Server

## Stack

- Node.js 20+
- Express 5
- MongoDB + Mongoose
- JWT
- bcryptjs
- Jest + Supertest
- mongodb-memory-server

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `MONGO_URI` and `JWT_SECRET`.
3. Install dependencies:

```bash
npm install
```

4. Start MongoDB and run:

```bash
npm run dev
```

API base URL: `http://localhost:5000/api/v1`

Health check: `GET /health`

## Test

```bash
npm test
```

## Main endpoints

### Auth
- `POST /auth/signup`
- `POST /auth/signin`
- `GET /users/me`

### Posts
- `GET /posts`
- `GET /posts/:id`
- `POST /posts`
- `PATCH /posts/:id`
- `PATCH /posts/:id/state`
- `DELETE /posts/:id`
- `POST /posts/:id/like`
- `DELETE /posts/:id/like`

### Social graph
- `POST /users/:id/follow`
- `DELETE /users/:id/follow`
- `GET /users/me/following`
- `GET /users/me/followers`
- `GET /users/me/posts`

## Post feed examples

Published feed, 20 per page by default:

`GET /api/v1/posts?page=1&limit=20`

Search title/tags:

`GET /api/v1/posts?search=nodejs`

Search author:

`GET /api/v1/posts?author=shola`

Filter/sort:

`GET /api/v1/users/me/posts?state=draft&sort=-updatedAt`

For the public feed, allowed sort fields are `like_count`, `comment_count`, and `createdAt`. Prefix a field with `-` for descending order, e.g. `sort=-like_count`.
