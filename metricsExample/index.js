const express = require('express');
const app = express();

const metrics = require('./metrics');
let greeting = 'hello';

app.use(express.json());

// GET endpoint
app.get('/hello/:name', (req, res) => {
  metrics.incrementRequests('GET');
  res.send({ [greeting]: req.params.name });
});

// POST endpoint to set the greeting
app.post('/greeting', (req, res) => {
  const { newGreeting } = req.body;
  if (!newGreeting) {
    return res.status(400).send({ error: 'New greeting is required' });
  }
  greeting = newGreeting;
  metrics.incrementRequests('POST');
  res.send({ message: 'Greeting updated', greeting });
});

// DELETE endpoint to reset the greeting
app.delete('/greeting', (req, res) => {
  greeting = 'hello';
  metrics.incrementRequests('DELETE');
  res.send({ message: 'Greeting reset to default', greeting });
});

app.listen(3000, () => {
  console.log(`Listening on port 3000`);
});
