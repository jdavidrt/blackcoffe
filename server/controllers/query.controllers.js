import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'

export const executeReadQuery = async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || !query.trim()) {
            return res.status(400).json({ message: "La consulta no puede estar vacía" });
        }

        // Strip SQL comments
        let sanitized = query
            .replace(/--.*$/gm, '')       // single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
            .trim()
            .replace(/\s+/g, ' ');

        if (!sanitized) {
            return res.status(400).json({ message: "La consulta no puede estar vacía" });
        }

        // Allow read-only commands: SELECT, SHOW, DESCRIBE/DESC, EXPLAIN
        const isReadOnly = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i.test(sanitized);
        if (!isReadOnly) {
            return res.status(400).json({ message: "Solo se permiten consultas de lectura (SELECT, SHOW, DESCRIBE, EXPLAIN)" });
        }

        // Reject semicolons (prevents stacked queries)
        if (sanitized.includes(';')) {
            return res.status(400).json({ message: "No se permiten múltiples consultas (punto y coma no permitido)" });
        }

        // Reject mutation keywords
        const forbidden = [
            'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
            'TRUNCATE', 'REPLACE', 'RENAME', 'GRANT', 'REVOKE',
            'CALL', 'EXEC', 'EXECUTE', 'SET', 'LOCK', 'UNLOCK',
            'LOAD', 'INTO\\s+OUTFILE', 'INTO\\s+DUMPFILE'
        ];
        const forbiddenRegex = new RegExp(`\\b(${forbidden.join('|')})\\b`, 'i');
        if (forbiddenRegex.test(sanitized)) {
            return res.status(400).json({ message: "Solo se permiten consultas de lectura. Palabras clave de modificación no están permitidas." });
        }

        // Auto-append LIMIT 1000 only for SELECT queries without LIMIT
        const isSelect = /^SELECT\b/i.test(sanitized);
        if (isSelect && !/\bLIMIT\b/i.test(sanitized)) {
            sanitized += ' LIMIT 1000';
        }

        const [rows] = await pool.query(sanitized);
        res.json({ rows, rowCount: rows.length });
    } catch (error) {
        sendErrorEmail(req, error, 'executeReadQuery');
        return res.status(500).json({ message: 'Error ejecutando la consulta' });
    }
}
