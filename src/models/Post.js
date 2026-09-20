const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
    state: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    like_count: { type: Number, default: 0, min: 0 },
    comment_count: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

postSchema.index({ state: 1, createdAt: -1 });
postSchema.index({ state: 1, like_count: -1 });
postSchema.index({ state: 1, comment_count: -1 });
postSchema.index({ title: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.model('Post', postSchema);
