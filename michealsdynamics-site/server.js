const config = require('./src/config');
const app = require('./src/app');

app.listen(config.port, () => {
  console.log(`Micheals Dynamics shop running at ${config.baseUrl} (port ${config.port})`);
});
