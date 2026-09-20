const app = require('./app');
const { connectDB } = require('./config/db');
const { port } = require('./config/env');

async function start() {
  await connectDB();
  app.listen(port, () => console.log(`Social App API running on port ${port}`));
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
