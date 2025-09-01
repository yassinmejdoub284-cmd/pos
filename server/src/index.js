const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const productsRoutes = require('./routes/products');
const usersRoutes = require('./routes/users');
const depotsRoutes = require('./routes/depots');
const stockRoutes = require('./routes/stock');
const expensesRoutes = require('./routes/expenses');
const reportsRoutes = require('./routes/reports');
const stockDocumentsRoutes = require('./routes/stock-documents');
const clientRoutes = require('./routes/clients');
const settingsRoutes = require('./routes/settings');

const { authenticateToken } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/products', authenticateToken, productsRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/depots', authenticateToken, depotsRoutes);
app.use('/api/stock', authenticateToken, stockRoutes);
app.use('/api/expenses', authenticateToken, expensesRoutes);
app.use('/api/reports', authenticateToken, reportsRoutes);
app.use('/api/stock-documents', authenticateToken, stockDocumentsRoutes);
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*'} });

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = server; 