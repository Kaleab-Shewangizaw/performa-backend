const app = require('./src/app');
const env = require('./src/config/env');

app.listen(env.port, () => {
  console.log(`performa-backend listening on port ${env.port} (${env.nodeEnv})`);
});
