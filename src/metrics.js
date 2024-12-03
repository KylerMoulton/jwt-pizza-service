const config = require('./config.js');
const os = require('os');

class Metrics {
  constructor() {
    this.totalRequestsByMethod = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
    this.activeUsers = 0;
    this.authAttempts = { success: 0, failed: 0 };
    this.pizzasSold = 0;
    this.creationFailures = 0;
    this.revenue = 0;
    this.latency = 0; // General service latency
    this.pizzaCreationLatency = 0; // Pizza creation latency

    const timer = setInterval(() => {
      this.sendMetricsToGrafana();
    }, 5000);
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

  // Increment or decrement active users count
  incrementActiveUsers() {
    this.activeUsers++;
  }

  decrementActiveUsers() {
    if (this.activeUsers > 0) {
      this.activeUsers--;
    }
  }

  // Increment pizzas sold and revenue
  incrementPizzaMetrics(pizzaPrice) {
    this.pizzasSold++;
    this.revenue += pizzaPrice;
  }

  incrementPizzaFailures() {
    this.creationFailures++;
  }

  // Track general service latency
  trackLatency(duration) {
    this.latency = duration;
  }

  // Track pizza creation latency
  trackPizzaCreationLatency(duration) {
    this.pizzaCreationLatency = duration;
  }

  // Get system metrics (CPU & Memory)
  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return (cpuUsage * 100).toFixed(2);
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return ((usedMemory / totalMemory) * 100).toFixed(2);
  }

  // Send all metrics to Grafana
  sendMetricsToGrafana() {
    Object.keys(this.totalRequestsByMethod).forEach((method) => {
      this.sendMetricToGrafana('request', method, 'total', this.totalRequestsByMethod[method]);
    });

    this.sendMetricToGrafana('auth', 'attempt', 'success', this.authAttempts.success);
    this.sendMetricToGrafana('auth', 'attempt', 'failed', this.authAttempts.failed);
    this.sendMetricToGrafana('users', 'activity', 'active_users', this.activeUsers);
    this.sendMetricToGrafana('pizza', 'sold', 'total', this.pizzasSold);
    this.sendMetricToGrafana('pizza', 'revenue', 'total', this.revenue);
    this.sendMetricToGrafana('pizza', 'failure', 'total', this.creationFailures);
    this.sendMetricToGrafana('latency', 'service', 'ms', this.latency);
    this.sendMetricToGrafana('latency', 'pizza_creation', 'ms', this.pizzaCreationLatency); // Pizza latency
    this.sendMetricToGrafana('system', 'cpu', 'usage', this.getCpuUsagePercentage());
    this.sendMetricToGrafana('system', 'memory', 'usage', this.getMemoryUsagePercentage());
  }

  // Send individual metric data to Grafana
  sendMetricToGrafana(metricPrefix, metricType, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.metrics.source},type=${metricType} ${metricName}=${metricValue}`;

    fetch(`${config.metrics.url}`, {
      method: 'POST',
      body: metric,
      headers: {
        Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
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

  metrics.incrementRequests(method);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.trackLatency(duration);
  });

  next();
};

// Middleware for authRouter to track auth attempts and active users
const authMetricsTracker = (req, res, next) => {
  res.on('finish', () => {
    const status = res.statusCode === 200 ? 'success' : 'failed';
    metrics.incrementAuthAttempt(status);

    if (req.method === 'PUT' && status === 'success') {
      metrics.incrementActiveUsers();
    }

    if (req.method === 'DELETE' && status === 'success') {
      metrics.decrementActiveUsers();
    }
  });

  next();
};

// Middleware for orderRouter to track pizza sales and latency
const orderMetricsTracker = (req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    if (req.method === 'POST' && res.statusCode != 500) {
      const order = req.body;
      order.items.forEach((item) => {
        metrics.incrementPizzaMetrics(item.price);
      });
      
      // Track latency specifically for pizza creation
      const duration = Date.now() - startTime;
      metrics.trackPizzaCreationLatency(duration);
    } else if (req.method === 'POST' && res.statusCode === 500){
      metrics.incrementPizzaFailures();
    }
  });

  next();
};

module.exports = {
  Metrics,
  requestTracker,
  authMetricsTracker,
  orderMetricsTracker,
};
