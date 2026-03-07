import { pool } from '../config/db.js';

// Get all clients
export const getClients = async (req, res, next) => {
    try {
        const { search, limit = 200, skip = 0 } = req.query;
        let query = `
            SELECT c.*, 
                   COUNT(DISTINCT p.id) as properties_count,
                   COUNT(DISTINCT i.id) as inspections_count
            FROM clients c
            LEFT JOIN properties p ON p.client_id = c.id
            LEFT JOIN inspections i ON i.client_id = c.id
            WHERE 1=1
        `;
        const values = [];
        let idx = 1;

        if (search) {
            query += ` AND (c.company_name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.contact_name ILIKE $${idx})`;
            values.push(`%${search}%`);
            idx++;
        }

        query += ` GROUP BY c.id ORDER BY c.company_name ASC LIMIT $${idx} OFFSET $${idx + 1}`;
        values.push(parseInt(limit), parseInt(skip));

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        next(error);
    }
};

// Get single client
export const getClientById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Client not found' });
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Create client
export const createClient = async (req, res, next) => {
    try {
        const { company_name, contact_name, email, phone, address, notes } = req.body;
        if (!company_name) return res.status(400).json({ error: 'company_name is required' });

        const { rows } = await pool.query(
            `INSERT INTO clients (company_name, contact_name, email, phone, address, notes) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [company_name, contact_name, email, phone, address, notes]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Update client
export const updateClient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { company_name, contact_name, email, phone, address, notes } = req.body;

        const { rows } = await pool.query(
            `UPDATE clients 
             SET company_name = COALESCE($1, company_name),
                 contact_name = COALESCE($2, contact_name),
                 email = COALESCE($3, email),
                 phone = COALESCE($4, phone),
                 address = COALESCE($5, address),
                 notes = COALESCE($6, notes),
                 updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [company_name, contact_name, email, phone, address, notes, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Client not found' });
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Delete client
export const deleteClient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rowCount } = await pool.query('DELETE FROM clients WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Client not found' });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
