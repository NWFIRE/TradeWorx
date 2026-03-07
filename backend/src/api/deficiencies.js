import { pool } from '../config/db.js';

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// Get all deficiencies
export const getDeficiencies = async (req, res, next) => {
    try {
        const { inspection_id, client_id, status, limit = 200, skip = 0 } = req.query;
        let query = `
            SELECT d.*,
                   c.company_name as client_name
            FROM deficiencies d
            LEFT JOIN clients c ON d.client_id = c.id
            WHERE 1=1
        `;
        const values = [];
        let idx = 1;

        if (inspection_id) { query += ` AND d.inspection_id = $${idx++}`; values.push(inspection_id); }
        if (client_id) { query += ` AND d.client_id = $${idx++}`; values.push(client_id); }
        if (status) { query += ` AND d.status = $${idx++}`; values.push(status); }

        query += ` ORDER BY d.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
        values.push(parseInt(limit), parseInt(skip));

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        next(error);
    }
};

// Get single deficiency
export const getDeficiencyById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(`
            SELECT d.*, c.company_name as client_name
            FROM deficiencies d
            LEFT JOIN clients c ON d.client_id = c.id
            WHERE d.id = $1
        `, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Deficiency not found' });
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Create deficiency
export const createDeficiency = async (req, res, next) => {
    try {
        const { inspection_id, assigned_to, property_id, title, description, location, severity, status, corrective_action, code_reference } = req.body;
        const client_id=assigned_to;
        if (!client_id || !title) return res.status(400).json({ error: 'client_id and title are required' });

        const sev = VALID_SEVERITIES.includes(severity) ? severity : 'medium';
        const istatus = VALID_STATUSES.includes(status) ? status : 'open';

        const { rows } = await pool.query(
            `INSERT INTO deficiencies (inspection_id, client_id, property_id, title, description, location, severity, status, corrective_action, code_reference)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [inspection_id || null, client_id, property_id || null, title, description || null, location || null, sev, istatus, corrective_action || null, code_reference || null]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Update deficiency
export const updateDeficiency = async (req, res, next) => {
    try {
        const { id } = req.params;
        const allowed = ['title', 'description', 'location', 'severity', 'status', 'corrective_action', 'code_reference', 'assigned_to_name', 'due_date'];
        const sets = [];
        const values = [];
        let idx = 1;

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                sets.push(`${key} = $${idx++}`);
                values.push(req.body[key]);
            }
        }
        if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
        sets.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE deficiencies SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, values
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Deficiency not found' });
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Delete deficiency
export const deleteDeficiency = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rowCount } = await pool.query('DELETE FROM deficiencies WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Deficiency not found' });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
