const config = require('./config.json');

class Metrics {
  constructor() {
    this.totalRequestsByMethod = { GET: 0, POST: 0, DELETE: 0 };

    // Periodically send metrics to Grafana
    const timer = setInterval(() => {
      Object.keys(this.totalRequestsByMethod).forEach((method) => {
        this.sendMetricToGrafana('request', method, 'total', this.totalRequestsByMethod[method]);
      });
    }, 10000);
    timer.unref();
  }

  incrementRequests(method) {
    if (this.totalRequestsByMethod[method] !== undefined) {
      this.totalRequestsByMethod[method]++;
    }
  }

  sendMetricToGrafana(metricPrefix, httpMethod, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.source},method=${httpMethod} ${metricName}=${metricValue}`;

    fetch(`${config.url}`, {
      method: 'post',
      body: metric,
      headers: { Authorization: `Bearer ${config.userId}:${config.apiKey}` },
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
module.exports = metrics;
