const { app } = require('./app');
const { startExpressServer } = require('./runtime');

const port = Number(process.env.PORT) || 3000;

if (require.main === module) {
    startExpressServer(app, port);
}

module.exports = require('./app');
