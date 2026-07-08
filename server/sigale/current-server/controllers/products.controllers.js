import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'

export const getProducts = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT id, productName , unitValue FROM products ORDER BY productName ASC")
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getProducts');
        return res.status(500).json({ message: error.message });
    }
}

export const getProduct = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT * FROM products WHERE id = ?", [
            req.params.id,
        ]);

        if (result.length === 0)
            return res.status(404).json({ message: "Producto no encontrado" });

        res.json(result[0]);
    } catch (error) {
        sendErrorEmail(req, error, 'getProduct');
        return res.status(500).json({ message: error.message });
    }
}

export const createProduct = async (req, res) => {
    try {
        const { productName, unitValue } = req.body
        const result = await pool.query("INSERT INTO products(productName, unitValue) VALUES (?, ?)", [
            productName,
            unitValue]
        );
        res.json({
            productName,
            unitValue
        })
    } catch (error) {
        sendErrorEmail(req, error, 'createProduct');
        return res.status(500).json({ message: error.message });
    }
}

export const updateProduct = async (req, res) => {
    try {
        const result = await pool.query("UPDATE products SET ? WHERE id = ?", [
            req.body,
            req.params.id,
        ]);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'updateProduct');
        return res.status(500).json({ message: error.message });
    }
}

export const deleteProduct = async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM products WHERE id = ?", [
            req.params.id,
        ]);
        if (result.affectedRows === 0)
            return res.status(404).json({ message: "Product not found" });
        return res.sendStatus(204);
    } catch (error) {
        sendErrorEmail(req, error, 'deleteProduct');
        return res.status(500).json({ message: error.message });
    }
};
