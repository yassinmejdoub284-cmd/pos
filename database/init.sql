-- Create database if not exists
CREATE DATABASE IF NOT EXISTS pos_patisserie CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pos_patisserie;

-- Insert sample depots
INSERT INTO depots (name, code, type, address, city, phone, email) VALUES
('Dépôt Principal Sfax', 'SFX-MAIN', 'MAIN', '123 Rue de la Liberté', 'Sfax', '+216 74 123 456', 'sfax@patisserie.tn'),
('Dépôt Tunis', 'TUN-BRANCH', 'BRANCH', '456 Avenue Habib Bourguiba', 'Tunis', '+216 71 234 567', 'tunis@patisserie.tn'),
('Boutique Centre Ville', 'SHOP-CV', 'SHOP', '789 Place de la République', 'Sfax', '+216 74 345 678', 'shop@patisserie.tn');

-- Insert sample product categories
INSERT INTO product_categories (name, description) VALUES
('Pâtisseries', 'Gâteaux et pâtisseries traditionnelles'),
('Viennoiseries', 'Croissants, pains au chocolat, etc.'),
('Biscuits', 'Biscuits et cookies'),
('Boissons', 'Café, thé, jus de fruits'),
('Glaces', 'Crèmes glacées et sorbets');

-- Insert sample products
INSERT INTO products (name, description, price, cost, category_id, barcode, sku, unit, min_stock_level, max_stock_level) VALUES
('Croissant Classique', 'Croissant au beurre traditionnel', 1.20, 0.60, 2, '1234567890123', 'CRO-001', 'pièce', 50, 200),
('Pain au Chocolat', 'Pain au chocolat noir', 1.50, 0.75, 2, '1234567890124', 'PAC-001', 'pièce', 40, 150),
('Éclair au Chocolat', 'Éclair garni de crème pâtissière et chocolat', 2.50, 1.25, 1, '1234567890125', 'ECL-001', 'pièce', 30, 100),
('Mille-Feuille', 'Mille-feuille à la vanille', 3.00, 1.50, 1, '1234567890126', 'MF-001', 'pièce', 20, 80),
('Tarte aux Pommes', 'Tarte aux pommes traditionnelle', 4.50, 2.25, 1, '1234567890127', 'TAP-001', 'pièce', 15, 60),
('Café Expresso', 'Expresso italien', 1.80, 0.90, 4, '1234567890128', 'CAF-001', 'tasse', 100, 300),
('Thé à la Menthe', 'Thé vert à la menthe fraîche', 2.00, 1.00, 4, '1234567890129', 'THE-001', 'tasse', 80, 250),
('Cookie Chocolat', 'Cookie aux pépites de chocolat', 1.00, 0.50, 3, '1234567890130', 'COO-001', 'pièce', 60, 200);

-- Insert sample payment methods
INSERT INTO payment_methods (name, type) VALUES
('Espèces', 'CASH'),
('Carte Bancaire', 'CARD'),
('Mobile Money', 'MOBILE'),
('Virement Bancaire', 'BANK_TRANSFER');

-- Insert sample users (password: admin123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role, depot_id) VALUES
('admin', 'admin@patisserie.tn', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeG', 'Admin', 'Principal', 'ADMIN', 1),
('manager_sfax', 'manager.sfax@patisserie.tn', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeG', 'Ahmed', 'Ben Ali', 'MANAGER', 1),
('cashier1', 'cashier1@patisserie.tn', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeG', 'Fatma', 'Trabelsi', 'CASHIER', 3),
('stock_manager', 'stock@patisserie.tn', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeG', 'Mohamed', 'Hassan', 'STOCK_MANAGER', 1);

-- Insert sample customers
INSERT INTO customers (name, email, phone, address, loyalty_points) VALUES
('Ali Ben Salem', 'ali.bensalem@email.tn', '+216 74 111 222', '15 Rue de la Paix, Sfax', 150),
('Amina Karray', 'amina.karray@email.tn', '+216 74 333 444', '28 Avenue de l\'Indépendance, Sfax', 75),
('Hassan Trabelsi', 'hassan.trabelsi@email.tn', '+216 74 555 666', '7 Rue du Commerce, Sfax', 200);

-- Insert sample inventory
INSERT INTO inventory (depot_id, product_id, quantity, reserved_quantity) VALUES
(1, 1, 150, 0),
(1, 2, 120, 0),
(1, 3, 80, 0),
(1, 4, 60, 0),
(1, 5, 40, 0),
(1, 6, 200, 0),
(1, 7, 180, 0),
(1, 8, 120, 0),
(2, 1, 100, 0),
(2, 2, 80, 0),
(2, 3, 50, 0),
(2, 4, 40, 0),
(2, 5, 25, 0),
(2, 6, 150, 0),
(2, 7, 120, 0),
(2, 8, 80, 0),
(3, 1, 80, 0),
(3, 2, 60, 0),
(3, 3, 40, 0),
(3, 4, 30, 0),
(3, 5, 20, 0),
(3, 6, 100, 0),
(3, 7, 80, 0),
(3, 8, 60, 0); 