require('dotenv').config();
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
const approvalsRoutes = require('./routes/approvals');
const reportsRoutes = require('./routes/reports');
const stockDocumentsRoutes = require('./routes/stock-documents');
const clientRoutes = require('./routes/clients');
const settingsRoutes = require('./routes/settings');
const sessionsRoutes = require('./routes/sessions');
const familiesRoutes = require('./routes/families');
const suppliersRoutes = require('./routes/suppliers');
const wholesaleRulesRoutes = require('./routes/wholesale-rules');
const supplierPaymentsRoutes = require('./routes/supplier-payments');
const clientStatementsRoutes = require('./routes/client-statements');
const clientPaymentsRoutes = require('./routes/client-payments');
const cashStatementsRoutes = require('./routes/cash-statements');
const inventoryRoutes = require('./routes/inventory');
const invoicesRoutes = require('./routes/invoices');
const returnsRoutes = require('./routes/returns');
const pdfRoutes = require('./routes/pdf');

const { authenticateToken } = require('./middleware/auth');

const app = express();

app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type']
}));
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/products', authenticateToken, productsRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/depots', authenticateToken, depotsRoutes);
app.use('/api/stock', authenticateToken, stockRoutes);
app.use('/api/expenses', authenticateToken, expensesRoutes);
app.use('/api/approvals', authenticateToken, approvalsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/stock-documents', stockDocumentsRoutes);
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/sessions', authenticateToken, sessionsRoutes);
app.use('/api/families', authenticateToken, familiesRoutes);
app.use('/api/suppliers', authenticateToken, suppliersRoutes);
app.use('/api/wholesale-rules', authenticateToken, wholesaleRulesRoutes);
app.use('/api/supplier-payments', authenticateToken, supplierPaymentsRoutes);
app.use('/api/client-statements', authenticateToken, clientStatementsRoutes);
app.use('/api/client-payments', authenticateToken, clientPaymentsRoutes);
app.use('/api/cash-statements', authenticateToken, cashStatementsRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/invoices', authenticateToken, invoicesRoutes);
app.use('/api/returns', authenticateToken, returnsRoutes);
app.use('/api/pdf', authenticateToken, pdfRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*'} });

// Make io instance available to routes
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3255;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = server; 