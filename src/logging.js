const { httpLogger, dbLogger, factoryLogger, unhandledErrorLogger } = require('pizza-logger');
const config = require('./config.js');

class Logger {
  constructor() {
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.url}`, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.userId}:${config.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) {
        console.log('Failed to send log to Grafana');
      }
    });
  }

  sanitizeLogData(data) {
    if (data.password) {
      data.password = '****'; // Mask password
    }
    if (data.token) {
      data.token = '****'; // Mask token
    }
    return data;
  }
}

const logger = new Logger();

const logHttpRequests = (req, res, next) => {
  req.body = logger.sanitizeLogData(req.body);
  logger.sendLogToGrafana({
    event: 'http-request',
    method: req.method,
    path: req.path,
    body: req.body,
    statusCode: res.statusCode,
  });
  next();
}

const logDbQuery = (req, res, next) => {
  res.on('finish', () => {
    // Assuming SQL queries are in req.query or similar
    const sqlQuery = req.query.sqlQuery || 'No SQL Query';  // Adjust based on where the query is stored
    logger.sendLogToGrafana({
      event: 'db-query',
      query: sqlQuery,
    });
  });
  next();
}

const logFactoryRequest = (req, res, next) => {
  res.on('finish', () => {
    const orderInfo = req.body || 'No order info';  // Assuming order info is in the request body
    logger.sendLogToGrafana({
      event: 'factory-request',
      orderInfo: orderInfo,
    });
  });
  next();
}

const logUnhandledError = (err, req, res, next) => {
  logger.sendLogToGrafana({
    event: 'unhandled-error',
    error: err,
  });
  next();
}

module.exports = {
  Logger,
  logHttpRequests,
  logDbQuery,
  logFactoryRequest,
  logUnhandledError
};
