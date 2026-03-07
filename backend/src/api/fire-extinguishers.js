import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

// Get all fire extinguishers for an inspection
export const getFireExtinguishers = async (req, res, next) => {
    try {
        const { inspection_id } = req.query;
        let query = `
            SELECT * FROM fire_extinguishers
            WHERE 1=1
        `;
        let values = [];

        if (inspection_id) {
            query += ' AND inspection_id = $1';
            values.push(inspection_id);
        }

        query += ' ORDER BY created_at ASC';

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) {
        next(error);
    }
};

// Get single extinguisher
export const getFireExtinguisherById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM fire_extinguishers WHERE id = $1', [id]);

        if (rows.length === 0) throw new AppError('Fire extinguisher not found', 404);
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Create fire extinguisher
export const createFireExtinguisher = async (req, res, next) => {
    try {
        const { inspection_id, location, size, type, mfg_year, last_hydro_year, last_service_year, pass_fail, notes } = req.body;

        if (!inspection_id) throw new AppError('Inspection ID is required', 400);

        const { rows } = await pool.query(
            `INSERT INTO fire_extinguishers (inspection_id, location, size, type, mfg_year, last_hydro_year, last_service_year, pass_fail, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [inspection_id, location, size, type, mfg_year, last_hydro_year, last_service_year, pass_fail, notes]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Update fire extinguisher
export const updateFireExtinguisher = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { location, size, type, mfg_year, last_hydro_year, last_service_year, pass_fail, notes } = req.body;

        const { rows } = await pool.query(
            `UPDATE fire_extinguishers 
             SET location = COALESCE($1, location), 
                 size = COALESCE($2, size), 
                 type = COALESCE($3, type), 
                 mfg_year = COALESCE($4, mfg_year),
                 last_hydro_year = COALESCE($5, last_hydro_year),
                 last_service_year = COALESCE($6, last_service_year),
                 pass_fail = COALESCE($7, pass_fail),
                 notes = COALESCE($8, notes),
                 updated_at = NOW()
             WHERE id = $9 RETURNING *`,
            [location, size, type, mfg_year, last_hydro_year, last_service_year, pass_fail, notes, id]
        );

        if (rows.length === 0) throw new AppError('Fire extinguisher not found', 404);
        res.json(rows[0]);
    } catch (error) {
        next(error);
    }
};

// Delete fire extinguisher
export const deleteFireExtinguisher = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rowCount } = await pool.query('DELETE FROM fire_extinguishers WHERE id = $1', [id]);

        if (rowCount === 0) throw new AppError('Fire extinguisher not found', 404);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
