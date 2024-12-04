const config = require('./config.js');

class Logger {
  constructor() {
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.url}`, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) {
        console.log('Failed to send log to Grafana');
      }
    });
  }

  sanitizeLogData(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }
  
  log(level, type, logData) {
    const labels = { component: config.source, level: level, type: type };
    const values = [this.nowString(), this.sanitizeLogData(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }
}

const logger = new Logger();

const logHttpRequests = (req, res, next) => {
  res.on('finish', () => {
    const logData = {
      authorized: !!req.headers.authorization,
      path: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      reqBody: JSON.stringify(req.body),
      resBody: JSON.stringify(resBody),
    };
    const level = this.statusToLogLevel(res.statusCode)
    logger.log(level, 'http', logData);
  })
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
