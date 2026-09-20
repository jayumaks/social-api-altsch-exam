const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    first_name: { type: String, required: true, trim: true, maxlength: 80 },
    last_name: { type: String, required: true, trim: true, maxlength: 80 },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 8, select: false },
    bio: { type: String, default: '', maxlength: 500 },
    avatar_url: { type: String, default: '' }
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    first_name: this.first_name,
    last_name: this.last_name,
    username: this.username,
    email: this.email,
    bio: this.bio,
    avatar_url: this.avatar_url,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
