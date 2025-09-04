-- Create database if not exists
CREATE DATABASE IF NOT EXISTS pos_patisserie CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pos_patisserie;

-- Insert sample depots
INSERT INTO depots (name, code, type, address, city, phone, email) VALUES
('Dépôt Principal Sfax', 'SFX-MAIN', 'MAIN', '123 Rue de la Liberté', 'Sfax', '+216 74 123 456', 'sfax@patisserie.tn'),
('Dépôt Tunis', 'TUN-BRANCH', 'BRANCH', '456 Avenue Habib Bourguiba', 'Tunis', '+216 71 234 567', 'tunis@patisserie.tn'),
('Boutique Centre Ville', 'SHOP-CV', 'SHOP', '789 Place de la République', 'Sfax', '+216 74 345 678', 'shop@patisserie.tn');

-- Insert sample product families
INSERT INTO product_families (name, description) VALUES
('Pâtisseries', 'Gâteaux et pâtisseries traditionnelles'),
('Viennoiseries', 'Croissants, pains au chocolat, etc.'),
('Biscuits', 'Biscuits et cookies'),
('Boissons', 'Café, thé, jus de fruits'),
('Glaces', 'Crèmes glacées et sorbets');

-- Insert sample products
INSERT INTO products (name, description, famille_id, barcode, unite, prix_vente_ttc, tva) VALUES
('Croissant Classique', 'Croissant au beurre traditionnel', 2, '1234567890123', 'pièce', 1.20, 19),
('Pain au Chocolat', 'Pain au chocolat noir', 2, '1234567890124', 'pièce', 1.50, 19),
('Éclair au Chocolat', 'Éclair garni de crème pâtissière et chocolat', 1, '1234567890125', 'pièce', 2.50, 19),
('Mille-Feuille', 'Mille-feuille à la vanille', 1, '1234567890126', 'pièce', 3.00, 19),
('Tarte aux Pommes', 'Tarte aux pommes traditionnelle', 1, '1234567890127', 'pièce', 4.50, 19),
('Café Expresso', 'Expresso italien', 4, '1234567890128', 'tasse', 1.80, 19),
('Thé à la Menthe', 'Thé vert à la menthe fraîche', 4, '1234567890129', 'tasse', 2.00, 19),
('Cookie Chocolat', 'Cookie aux pépites de chocolat', 3, '1234567890130', 'pièce', 1.00, 19);

-- Insert sample users (password: admin123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role, depot_id) VALUES
('admin', 'admin@patisserie.tn', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeG', 'Admin', 'Principal', 'ADMIN', 1),
('manager_sfax', 'manager.sfax@patisserie.tn', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeG', 'Ahmed', 'Ben Ali', 'MANAGER', 1),
('cashier1', 'cashier1@patisserie.tn', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeG', 'Fatma', 'Trabelsi', 'CASHIER', 3),
('stock_manager', 'stock@patisserie.tn', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uOeG', 'Mohamed', 'Hassan', 'STOCK_MANAGER', 1);

-- Insert sample clients
INSERT INTO clients (code, first_name, last_name, email, phone, address, city) VALUES
('CLI001', 'Ali', 'Ben Salem', 'ali.bensalem@email.tn', '+216 74 111 222', '15 Rue de la Paix', 'Sfax'),
('CLI002', 'Amina', 'Karray', 'amina.karray@email.tn', '+216 74 333 444', '28 Avenue de l\'Indépendance', 'Sfax'),
('CLI003', 'Hassan', 'Trabelsi', 'hassan.trabelsi@email.tn', '+216 74 555 666', '7 Rue du Commerce', 'Sfax');

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