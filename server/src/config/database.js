import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_patisserie',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

let pool;

export async function connectDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    const connection = await pool.getConnection();

    connection.release();
    
    await initializeTables();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export function getPool() {
  return pool;
}

async function initializeTables() {
  const connection = await pool.getConnection();
  
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        role ENUM('ADMIN', 'MANAGER', 'CASHIER', 'STOCK_MANAGER') NOT NULL,
        depot_id INT,
        is_active BOOLEAN DEFAULT TRUE,
        last_login DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS depots (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        type ENUM('MAIN', 'BRANCH', 'SHOP', 'WAREHOUSE') NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(50) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        manager_id INT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES users(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        cost DECIMAL(10,2) NOT NULL,
        category_id INT NOT NULL,
        barcode VARCHAR(50) UNIQUE,
        sku VARCHAR(50) UNIQUE NOT NULL,
        unit VARCHAR(20) NOT NULL,
        min_stock_level INT DEFAULT 0,
        max_stock_level INT DEFAULT 1000,
        is_active BOOLEAN DEFAULT TRUE,
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES product_categories(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INT PRIMARY KEY AUTO_INCREMENT,
        depot_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT DEFAULT 0,
        reserved_quantity INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (depot_id) REFERENCES depots(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        UNIQUE KEY unique_depot_product (depot_id, product_id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        address TEXT,
        loyalty_points INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        type ENUM('CASH', 'CARD', 'MOBILE', 'BANK_TRANSFER') NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT PRIMARY KEY AUTO_INCREMENT,
        total DECIMAL(10,2) NOT NULL,
        tax DECIMAL(10,2) DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        final_total DECIMAL(10,2) NOT NULL,
        payment_method_id INT NOT NULL,
        status ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED') DEFAULT 'PENDING',
        cashier_id INT NOT NULL,
        customer_id INT,
        depot_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
        FOREIGN KEY (cashier_id) REFERENCES users(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (depot_id) REFERENCES depots(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sale_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        depot_id INT NOT NULL,
        quantity INT NOT NULL,
        type ENUM('IN', 'OUT', 'TRANSFER') NOT NULL,
        from_depot_id INT,
        to_depot_id INT,
        reason VARCHAR(200) NOT NULL,
        reference VARCHAR(100),
        user_id INT NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (depot_id) REFERENCES depots(id),
        FOREIGN KEY (from_depot_id) REFERENCES depots(id),
        FOREIGN KEY (to_depot_id) REFERENCES depots(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock_transfers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        from_depot_id INT NOT NULL,
        to_depot_id INT NOT NULL,
        status ENUM('PENDING', 'APPROVED', 'TRANSFERRED', 'CANCELLED') DEFAULT 'PENDING',
        requested_by INT NOT NULL,
        approved_by INT,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        transferred_at TIMESTAMP NULL,
        notes TEXT,
        FOREIGN KEY (from_depot_id) REFERENCES depots(id),
        FOREIGN KEY (to_depot_id) REFERENCES depots(id),
        FOREIGN KEY (requested_by) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        transfer_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        transferred_quantity INT DEFAULT 0,
        FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);


    
  } catch (error) {
    console.error('❌ Error initializing tables:', error);
    throw error;
  } finally {
    connection.release();
  }
} 