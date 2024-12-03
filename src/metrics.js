const config = require('./config.js');
const os = require('os');

class Metrics {
  constructor() {
    this.totalRequestsByMethod = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
    this.activeUsers = 0;
    this.authAttempts = { success: 0, failed: 0 };
    this.pizzasSold = 0;
    this.revenue = 0;
    this.latency = 0;

    const timer = setInterval(() => {
      this.sendMetricsToGrafana();
    }, 10000); 
    timer.unref();
  }

  // Increment request count based on HTTP method
  incrementRequests(method) {
    if (this.totalRequestsByMethod[method] !== undefined) {
      this.totalRequestsByMethod[method]++;
    }
  }

  // Increment successful and failed auth attempts
  incrementAuthAttempt(status) {
    if (status === 'success') {
      this.authAttempts.success++;
    } else {
      this.authAttempts.failed++;
    }
  }

  // Increment pizzas sold and revenue
  incrementPizzaMetrics(pizzaPrice) {
    this.pizzasSold++;
    this.revenue += pizzaPrice;
  }

  // Track service latency
  trackLatency(duration) {
    this.latency = duration; // Capture latency for each request
  }

  // Get system metrics (CPU & Memory)
  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  // Send all metrics to Grafana
  sendMetricsToGrafana() {
    const { source, url, userId, apiKey } = config;

    // HTTP request count
    Object.keys(this.totalRequestsByMethod).forEach((method) => {
      this.sendMetricToGrafana('request', method, 'total', this.totalRequestsByMethod[method]);
    });

    // auth attempts
    this.sendMetricToGrafana('auth', 'attempt', 'success', this.authAttempts.success);
    this.sendMetricToGrafana('auth', 'attempt', 'failed', this.authAttempts.failed);

    // pizza sales
    this.sendMetricToGrafana('pizza', 'sold', 'total', this.pizzasSold);
    this.sendMetricToGrafana('pizza', 'revenue', 'total', this.revenue);

    // latency
    this.sendMetricToGrafana('latency', 'service', 'ms', this.latency);

    // system metrics
    this.sendMetricToGrafana('system', 'cpu', 'usage', this.getCpuUsagePercentage());
    this.sendMetricToGrafana('system', 'memory', 'usage', this.getMemoryUsagePercentage());
  }

  // Send individual metric data to Grafana
  sendMetricToGrafana(metricPrefix, metricType, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.metrics.source},type=${metricType} ${metricName}=${metricValue}`;
    
    // Make the POST request to Grafana
    fetch(`${config.metrics.url}`, {
      method: 'POST',
      body: metric,
      headers: {
        'Authorization': `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
    }
}

const metrics = new Metrics();

// Middleware to track requests for all routers
const requestTracker = async (req, res, next) => {
  const method = req.method;
  const endpoint = req.originalUrl;

  // Increment request count for the method
  metrics.incrementRequests(method);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.trackLatency(duration);
  });

  next();
};

// Middleware for authRouter to track auth attempts (success/failure)
const authAttemptTracker = (req, res, next) => {
  res.on('finish', () => {
    const status = res.statusCode === 200 ? 'success' : 'failed';
    metrics.incrementAuthAttempt(status);
  });

  next();
};

// Middleware for orderRouter to track pizza sales
const orderMetricsTracker = (req, res, next) => {
  res.on('finish', () => {
    if (req.method === 'POST' && res.statusCode === 201) {
      const order = req.body;
      order.items.forEach((item) => {
        metrics.incrementPizzaMetrics(item.price);
      });
    }
  });

  next();
};

module.exports = {
  metrics,
  requestTracker,
  authAttemptTracker,
  orderMetricsTracker,
};
