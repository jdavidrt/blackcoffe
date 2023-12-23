
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shopId INT NOT NULL,
    clientId INT NOT NULL,
    paymentMethod VARCHAR(20) NOT NULL,
    paid BOOLEAN DEFAULT 0,
    paidAt DATETIME,
    items TEXT,
    deposit INT
);