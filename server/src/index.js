require('dotenv').config();

// Suppress HTTP/2 status message warning (harmless, HTTP/2 doesn't support status messages)
process.on('warning', (warning) => {
  if (warning.name === 'UnsupportedWarning' && warning.message.includes('Status message is not supported by HTTP/2')) {
    return; // Suppress this specific warning
  }
  console.warn(warning.name, warning.message);
});

const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const productsRoutes = require('./routes/products');
const usersRoutes = require('./routes/users');
const depotsRoutes = require('./routes/depots');
const stockRoutes = require('./routes/stock');
const expensesRoutes = require('./routes/expenses');
const approvalsRoutes = require('./routes/approvals');
const pushRoutes = require('./routes/push');
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

const returnsRoutes = require('./routes/returns');
const companiesRoutes = require('./routes/companies');
const pdfRoutes = require('./routes/pdf');
const produitsDeCaisseRoutes = require('./routes/produits-de-caisse');
const driversRoutes = require('./routes/drivers');
const vehiclesRoutes = require('./routes/vehicles');
const adminDashboardRoutes = require('./routes/admin-dashboard');
const invoicesRoutes = require('./routes/invoices');
const auditLogsRoutes = require('./routes/audit-logs');

const { authenticateToken } = require('./middleware/auth');

const app = express();

app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Depot-Id'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type']
}));
// Handle CORS preflight requests globally
app.options('*', cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Depot-Id'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type']
}));
app.use(express.json());


// Serve static files from uploads directory
app.use('/uploads', express.static(path.join((process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..')), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
// Allow unauthenticated access to wholesale sales
app.use('/api/sales/public', salesRoutes);
app.use('/api/products', authenticateToken, productsRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/depots', authenticateToken, depotsRoutes);
app.use('/api/stock', authenticateToken, stockRoutes);
app.use('/api/expenses', authenticateToken, expensesRoutes);
app.use('/api/approvals', authenticateToken, approvalsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/reports', authenticateToken, reportsRoutes);
app.use('/api/stock-documents', authenticateToken, stockDocumentsRoutes);
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

app.use('/api/returns', authenticateToken, returnsRoutes);
app.use('/api/pdf', authenticateToken, pdfRoutes);
app.use('/api/companies', authenticateToken, companiesRoutes);
app.use('/api/produits-de-caisse', authenticateToken, produitsDeCaisseRoutes);
app.use('/api/drivers', authenticateToken, driversRoutes);
app.use('/api/vehicles', authenticateToken, vehiclesRoutes);
app.use('/api/admin-dashboard', authenticateToken, adminDashboardRoutes);
app.use('/api/invoices', authenticateToken, invoicesRoutes);
app.use('/api/audit-logs', auditLogsRoutes);

// Create HTTP or HTTPS server based on env
let server;
try {
  const keyPath = './certs/key.pem';
  const certPath = './certs/cert.pem';
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const sslOptions = {
      key: fs.readFileSync(path.resolve(keyPath)),
      cert: fs.readFileSync(path.resolve(certPath))
    };
    server = https.createServer(sslOptions, app);

  } else {
    server = http.createServer(app);

  }
} catch (e) {
  server = http.createServer(app);

}

const PORT = process.env.PORT || 3255;
server.listen(PORT, () => {
  console.log(`Server connected and listening on port ${PORT}`);
});

module.exports = server; 