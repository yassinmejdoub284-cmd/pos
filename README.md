# Tunisian Pâtisserie POS System

A comprehensive Point of Sale system designed specifically for Tunisian pâtisseries with multi-depot stock management, real-time synchronization, and offline capabilities.

## 🏗️ Architecture

- **Frontend**: Angular 19.2 with Signals, Tailwind CSS, PWA
- **Desktop**: Tauri wrapper for native desktop app
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: MySQL (production) / SQLite (desktop offline)
- **Real-time**: Socket.IO for live updates
- **Offline**: IndexedDB (web) + SQLite (desktop) with queue system

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+ (for production)
- Git

### 1. Clone and Setup

```bash
git clone <repository-url>
cd PoS_Patisserie
```

### 2. Database Setup

#### Option A: Using MySQL (Recommended for Production)

1. Install MySQL and create database:
```sql
CREATE DATABASE pos_patisserie;
```

2. Configure environment:
```bash
cd server
cp env.example .env
# Edit .env with your MySQL credentials
```

3. Initialize database with Prisma:
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
```

#### Option B: Using SQLite (Development)

1. Update `server/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

2. Initialize database:
```bash
cd server
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 3. Backend Setup

```bash
cd server
npm install
npm run dev
```

Server will start on `http://localhost:3000`

### 4. Frontend Setup

```bash
cd client/pos-patisserie
npm install
npm start
```

Frontend will start on `http://localhost:4200`

### 5. Desktop App (Optional)

```bash
cd client/pos-patisserie
npm run tauri dev
```

## 🔐 Default Credentials

- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Administrator

## 📁 Project Structure

```
PoS_Patisserie/
├── client/pos-patisserie/          # Angular Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── caisse/            # POS/Cashier Module
│   │   │   ├── historique/        # Sales History
│   │   │   ├── cloture/          # Daily Closing
│   │   │   ├── stock/            # Inventory Management
│   │   │   ├── parametres/       # Settings
│   │   │   ├── rapports/         # Reports
│   │   │   └── approvals/        # Admin Approvals
│   │   ├── core/
│   │   │   ├── models/           # TypeScript Interfaces
│   │   │   └── services/         # Core Services
│   │   └── styles.css            # Tailwind CSS
│   ├── src-tauri/                # Tauri Desktop Config
│   └── manifest.webmanifest      # PWA Manifest
├── server/                       # Node.js Backend
│   ├── src/
│   │   ├── routes/              # API Routes
│   │   ├── middleware/          # Auth & Validation
│   │   ├── socket/              # WebSocket Handlers
│   │   └── lib/                 # Utilities
│   ├── prisma/
│   │   ├── schema.prisma        # Database Schema
│   │   └── seed.js              # Sample Data
│   └── .env                     # Environment Variables
└── database/
    └── init.sql                 # Legacy SQL Setup
```

## ✨ Features

### Core Modules
- **Caisse (POS)**: Sales processing, payment handling
- **Historique**: Complete sales history and analytics
- **Clôture**: Daily closing and cash management
- **Stock**: Multi-depot inventory management
- **Paramètres**: System configuration
- **Rapports**: Business intelligence and reports
- **Approvals**: Admin-only transfer approvals

### Multi-Depot System
- **Dépôt Sfax** → **Dépôt Tunis** → **Shop** workflow
- Real-time stock synchronization
- Transfer request/approval system
- Depot-specific access control

### Offline Capabilities
- **Web**: IndexedDB with Dexie.js
- **Desktop**: SQLite with Tauri
- Queue system for offline operations
- Automatic sync when online

### Real-time Features
- Live stock updates across depots
- Instant sales notifications
- Transfer status updates
- User activity monitoring

## 🛠️ Development

### Backend Commands

```bash
cd server

# Development
npm run dev                    # Start with nodemon
npm run db:generate           # Generate Prisma client
npm run db:push               # Push schema to database
npm run db:seed               # Seed sample data
npm run db:studio             # Open Prisma Studio

# Testing
npm test                      # Run tests
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report
```

### Frontend Commands

```bash
cd client/pos-patisserie

# Development
npm start                     # Start dev server
npm run build                # Production build
npm run tauri dev            # Desktop app dev
npm run tauri build          # Desktop app build

# Testing
npm test                     # Unit tests
npm run e2e                  # E2E tests
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="mysql://user:password@localhost:3306/pos_patisserie"

# JWT
JWT_SECRET=your-super-secret-key

# Server
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:4200
```

### Prisma Schema

The database schema is defined in `server/prisma/schema.prisma` with:

- **Users**: Authentication and role management
- **Depots**: Multi-location management
- **Products**: Inventory items with categories
- **Sales**: Transaction records
- **Stock**: Inventory levels per depot
- **Transfers**: Inter-depot stock movements

## 🧪 Testing

### Backend Tests
- **Unit Tests**: Vitest + Supertest
- **API Tests**: Endpoint validation
- **Database Tests**: Prisma integration

### Frontend Tests
- **Unit Tests**: Vitest
- **E2E Tests**: Playwright
- **Component Tests**: Angular testing utilities

## 📱 PWA & Desktop Features

### Progressive Web App
- Offline functionality
- Push notifications
- Install prompt
- Service worker caching

### Desktop Application
- Native OS integration
- System tray support
- Auto-updates
- Hardware access (printers, barcode scanners)

## 🔒 Security

- JWT-based authentication
- Role-based access control (ADMIN, MANAGER, CASHIER, STOCK_MANAGER)
- Depot-specific permissions
- Input validation and sanitization
- CORS configuration
- Helmet.js security headers

## 📊 Database Schema

### Core Tables
- `users` - User accounts and roles
- `depots` - Multi-location management
- `products` - Inventory items
- `product_categories` - Product classification
- `inventory` - Stock levels per depot
- `sales` - Transaction records
- `sale_items` - Individual sale line items
- `stock_movements` - Inventory changes
- `stock_transfers` - Inter-depot transfers
- `customers` - Customer information
- `payment_methods` - Payment options

### Relationships
- Users belong to specific depots
- Products have categories and inventory levels
- Sales are linked to users, customers, and depots
- Stock movements track all inventory changes
- Transfers connect multiple depots

## 🚀 Deployment

### Production Setup

1. **Database**: Use MySQL with proper credentials
2. **Environment**: Set `NODE_ENV=production`
3. **Security**: Change default JWT secret
4. **SSL**: Configure HTTPS certificates
5. **Monitoring**: Set up logging and monitoring

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the troubleshooting guide

---

**Built with ❤️ for Tunisian Pâtisseries** 