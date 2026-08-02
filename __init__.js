const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const Userroutes = require('./routes/login');
const Dashboard = require('./routes/dashboard');
const customers = require('./routes/customers');
const dashboardHome = require('./routes/dashboardHome');
const users = require('./routes/users');
const logsRoute = require('./routes/logs');
const { connectDB } = require('./helpers/DbConnect');
const { startScheduler } = require('./helpers/deliveryScheduler');

async function startServer() {
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  await connectDB();
  startScheduler();

  app.use('/login', Userroutes);
  app.use('/dashboard', dashboardHome);
  app.use('/delivery', Dashboard);
  app.use('/dashboard/delivery', Dashboard);
  app.use('/dashboard/home', dashboardHome);
  app.use('/dashboard/customers', customers);
  app.use('/dashboard/users', users);
  app.use('/logs', logsRoute);

  app.get('/', (req, res) => {
    res.redirect('/login');
  });

  app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  });

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});