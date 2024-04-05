import pool from '../db.js'

export const getAllClients = async (req, res) => {
    const [result] = await pool.query("SELECT * FROM clients ORDER BY CAST(premises AS SIGNED), clientname ASC")
    //console.log(result);
    res.json(result)
}

export const getClients = async (req, res) => {
    const [result] = await pool.query("SELECT id, premises, clientName,  phoneNumber FROM clients WHERE mall = ? ORDER BY CAST(premises AS SIGNED), clientname ASC", [
        req.params.mall,
    ]);
    //console.log(result)
    res.json(result)
}
export const getClient = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT * FROM clients WHERE id = ?", [
            req.params.id,
        ]);

        if (result.length === 0)
            return res.status(404).json({ message: "Client not found" });

        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
export const createClient = async (req, res) => {
    try {
        const { premises, clientName, mall, phoneNumber } = req.body
        const result = await pool.query("INSERT INTO clients(premises, clientName, mall, phoneNumber) VALUES (?, ?, ?, ?)", [
            premises,
            clientName,
            mall,
            phoneNumber
        ]
        );
        res.json({
            premises,
            clientName,
            mall,
            phoneNumber
        })
        console.log(res);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
export const updateClient = async (req, res) => {
    try {
        const result = await pool.query("UPDATE clients SET ? WHERE id = ?", [
            req.body,
            req.params.id,
        ]);
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
export const deleteClient = async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM clients WHERE id = ?", [
            req.params.id,
        ]);
        if (result.affectedRows === 0)
            return res.status(404).json({ message: "Client not found" });
        return res.sendStatus(204);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
