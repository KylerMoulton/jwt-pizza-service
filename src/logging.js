const { httpLogger, dbLogger, factoryLogger, unhandledErrorLogger } = require('pizza-logger');
const config = require('./config.js');

class Logger {
  constructor() {
    const timer = setInterval(() => {
      this.sendLogsToGrafana();
    }, 5000);
    timer.unref();
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

  logHttpRequests(req, res, next) {
    req.body = this.sanitizeLogData(req.body);
    httpLogger(req, res);
    this.sendLogToGrafana({
      event: 'http-request',
      method: req.method,
      path: req.path,
      body: req.body,
      statusCode: res.statusCode,
    });
    next();
  }

  logDbQuery(sqlQuery) {
    dbLogger(sqlQuery);
    this.sendLogToGrafana({
      event: 'db-query',
      query: sqlQuery,
    });
  }

  logFactoryRequest(orderInfo) {
    factoryLogger(orderInfo);
    this.sendLogToGrafana({
      event: 'factory-request',
      orderInfo: orderInfo,
    });
  }

  logUnhandledError(err) {
    unhandledErrorLogger(err);
    this.sendLogToGrafana({
      event: 'unhandled-error',
      error: err,
    });
  }
}

module.exports = {
  Logger,
};
