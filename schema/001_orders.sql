-- File: schema/001_orders.sql

CREATE DATABASE IF NOT EXISTS flash_sale CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE flash_sale;

-- Orders table
CREATE TABLE orders (
  id BIGINT PRIMARY KEY COMMENT 'Snowflake ID',
  user_id BIGINT NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'CANCELED', 'EXPIRED') NOT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL,
  expires_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_status_expires (status, expires_at)
) ENGINE=InnoDB;

-- Order items
CREATE TABLE order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  sku_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_sku (sku_id)
) ENGINE=InnoDB;

-- Inventory audit log (append-only)
CREATE TABLE inventory_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sku_id INT NOT NULL,
  change_qty INT NOT NULL COMMENT 'Positive for increase, negative for decrease',
  reason VARCHAR(128) NOT NULL,
  ref_id VARCHAR(64) COMMENT 'Order ID or reservation ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sku_created (sku_id, created_at),
  INDEX idx_ref (ref_id)
) ENGINE=InnoDB;

-- SKU catalog (reference data)
CREATE TABLE skus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  initial_stock INT NOT NULL,
  flash_sale_start DATETIME,
  flash_sale_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_flash_sale (flash_sale_start, flash_sale_end)
) ENGINE=InnoDB;

-- Payments
CREATE TABLE payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(128),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  INDEX idx_order (order_id),
  INDEX idx_transaction (transaction_id)
) ENGINE=InnoDB;

