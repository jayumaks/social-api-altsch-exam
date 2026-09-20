const mongoose = require('mongoose');
const { mongoUri } = require('./env');

async function connectDB(uri = mongoUri) {
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDB, disconnectDB };
