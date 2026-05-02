import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'
import { pickAndValidate, PRODUCT_UPDATE_SCHEMA } from '../utils/validation.js'

export const getProducts = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT id, productName , unitValue FROM products ORDER BY productName ASC")
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getProducts');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
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
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const createProduct = async (req, res) => {
    try {
        // Audit fix 2.7: validate before insert.
        const { value, errors } = pickAndValidate(req.body, PRODUCT_UPDATE_SCHEMA);
        if (errors) return res.status(400).json({ message: errors[0] });
        const { productName, unitValue } = value;
        if (!productName || unitValue === undefined) {
            return res.status(400).json({ message: 'productName y unitValue son requeridos' });
        }
        await pool.query(
            "INSERT INTO products(productName, unitValue) VALUES (?, ?)",
            [productName, unitValue]
        );
        res.json({ productName, unitValue });
    } catch (error) {
        sendErrorEmail(req, error, 'createProduct');
        return res.status(500).json({ message: 'Error creando producto' });
    }
}

export const updateProduct = async (req, res) => {
    try {
        // Audit fix 2.7: whitelist allowed columns.
        const { value, errors } = pickAndValidate(req.body, PRODUCT_UPDATE_SCHEMA);
        if (errors) return res.status(400).json({ message: errors[0] });
        if (Object.keys(value).length === 0) {
            return res.status(400).json({ message: 'No hay campos válidos para actualizar' });
        }
        const result = await pool.query("UPDATE products SET ? WHERE id = ?", [
            value,
            req.params.id,
        ]);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'updateProduct');
        return res.status(500).json({ message: 'Error actualizando producto' });
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
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
};
