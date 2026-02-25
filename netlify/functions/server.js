const { app } = require('../../app');
const { createNetlifyHandler } = require('../../runtime');

exports.handler = createNetlifyHandler(app, 'server');
