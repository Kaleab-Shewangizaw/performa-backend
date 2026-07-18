const app = require('./src/app');
const env = require('./src/config/env');
const { connectDb } = require('./src/config/db');

connectDb()
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(env.port, () => {
      console.log(`performa-backend listening on port ${env.port} (${env.nodeEnv})`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
