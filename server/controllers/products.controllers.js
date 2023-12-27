import pool from '../db.js'

export const getProducts = async (req, res) => {
    const [result] = await pool.query("SELECT id, productName , unitValue FROM products ORDER BY createdAt ASC")
    //console.log(result);
    res.json(result)
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
        console.log(res);
    } catch (error) {
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
        return res.status(500).json({ message: error.message });
    }
};
