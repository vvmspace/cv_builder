const { app, startVacancyWorker } = require('./app');
const { startExpressServer } = require('./runtime');

const port = Number(process.env.PORT) || 3000;

if (require.main === module) {
    startExpressServer(app, port);
    startVacancyWorker({ intervalMs: 600_000 });
}

module.exports = require('./app');
