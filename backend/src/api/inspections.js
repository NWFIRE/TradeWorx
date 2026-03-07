import { pool } from '../config/db.js';

const VALID_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'requires_followup', 'invoiced'];
const VALID_TYPES = ['annual', 'semi_annual', 'quarterly', 'monthly', 'weekly', 'initial', 'followup', 'call_in', 'emergency'];

// Get all inspections
export const getInspections = async (req, res, next) => {
    try {
        const { client_id, inspector_id, status, inspection_type, sort = '-scheduled_date', limit = 100, skip = 0 } = req.query;

        let query = `
            SELECT i.*,
                   c.company_name as client_name
            FROM inspections i
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE 1=1
        `;
        const values = [];
        let idx = 1;

        if (client_id) { query += ` AND i.client_id = $${idx++}`; values.push(client_id); }
        if (inspector_id) { query += ` AND i.inspector_id = $${idx++}`; values.push(inspector_id); }
        if (status) { query += ` AND i.status = $${idx++}`; values.push(status); }
        if (inspection_type) { query += ` AND i.inspection_type = $${idx++}`; values.push(inspection_type); }

        // Sort: -field = DESC, field = ASC
        const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
        const sortDir = sort.startsWith('-') ? 'DESC' : 'ASC';
        const safeSort = ['scheduled_date', 'created_at', 'updated_at', 'status'].includes(sortField) ? sortField : 'scheduled_date';
        query += ` ORDER BY i.${safeSort} ${sortDir}`;
        query += ` LIMIT $${idx++} OFFSET $${idx++}`;
        values.push(parseInt(limit), parseInt(skip));

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        next(error);
    }
};

// Get single inspection
export const getInspectionById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(`
            SELECT i.*, c.company_name as client_name
            FROM inspections i
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE i.id = $1
        `, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Inspection not found' });
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Create inspection
export const createInspection = async (req, res, next) => {
    try {
        const {
            client_id, property_id, property_name, inspector_name,
            scheduled_date, inspection_type, status, notes
        } = req.body;

        if (!client_id || !scheduled_date) {
            return res.status(400).json({ error: 'client_id and scheduled_date are required' });
        }

        const itype = VALID_TYPES.includes(inspection_type) ? inspection_type : 'annual';
        const istatus = VALID_STATUSES.includes(status) ? status : 'scheduled';

        const { rows } = await pool.query(
            `INSERT INTO inspections (client_id, property_id, property_name, inspector_name, scheduled_date, inspection_type, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [client_id, property_id || null, property_name || null, inspector_name || null, scheduled_date, itype, istatus, notes || null]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Update inspection
export const updateInspection = async (req, res, next) => {
    try {
        const { id } = req.params;
        const fields = req.body;
        const allowed = ['status', 'inspector_name', 'scheduled_date', 'completed_date', 'inspection_type',
            'overall_result', 'notes', 'signature_url', 'pdf_url', 'signed_by_name', 'signed_at','is_priority'];
        const sets = [];
        const values = [];
        let idx = 1;

        for (const key of allowed) {
            if (fields[key] !== undefined) {
                sets.push(`${key} = $${idx++}`);
                values.push(fields[key]);
            }
        }
        if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
        sets.push(`updated_at = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE inspections SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, values
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Inspection not found' });
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Delete inspection
export const deleteInspection = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rowCount } = await pool.query('DELETE FROM inspections WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Inspection not found' });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
