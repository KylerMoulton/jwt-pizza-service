const config = require('./config.js');

class Logger {
  constructor() {
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
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
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitizeLogData(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }
}

const logger = new Logger();

const logHttpRequests = (req, res, next) => {
  let send = res.send;
  res.send = (resBody) => {
    const logData = {
      authorized: !!req.headers.authorization,
      path: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      reqBody: JSON.stringify(req.body),
      resBody: JSON.stringify(resBody),
    };
    const level = logger.statusToLogLevel(res.statusCode);
    logger.log(level, 'http', logData);
    res.send = send;
    return res.send(resBody);
  };
  next();
};

const logDbQuery = (params) => {
  const logData = {
    reqBody: JSON.stringify(params),
  };
  logger.log('info', 'db', logData);
};

const logUnhandledError = (err, req) => {
  const logData = {
    error: err.message,
    path: req.originalUrl,
    method: req.method,
    body: req.body,
    query: req.query,
    headers: req.headers,
  };

  logger.log('error', 'unhandled_error', logData);
};

module.exports = {
  Logger,
  logHttpRequests,
  logDbQuery,
  logUnhandledError
};
