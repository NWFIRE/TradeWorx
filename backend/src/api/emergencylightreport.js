import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export const getEmergencyLightReports = async (req, res, next) => {
    try {
        const { inspection_id } = req.query;
        let query = 'SELECT * FROM emergency_light_reports';
        let values = [];
        if (inspection_id) {
            query += ' WHERE inspection_id = $1';
            values.push(inspection_id);
        }
        query += ' ORDER BY created_at ASC';
        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (error) { next(error); }
};

export const getEmergencyLightReportById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM emergency_light_reports WHERE id = $1', [id]);
        if (rows.length === 0) throw new AppError('Not found', 404);
        res.json(rows[0]);
    } catch (error) { next(error); }
};

export const createEmergencyLightReport = async (req, res, next) => {
    try {
        // Dynamic insert
        const keys = Object.keys(req.body);
        const values = Object.values(req.body);
        const placeholders = keys.map((_, i) => '$' + (i + 1)).join(', ');
        
        const query = `INSERT INTO emergency_light_reports (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const { rows } = await pool.query(query, values);
        res.status(201).json(rows[0]);
    } catch (error) { next(error); }
};

export const updateEmergencyLightReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const keys = Object.keys(req.body);
        const values = Object.values(req.body);
        
        if (keys.length === 0) return res.json({});
        
        const setString = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
        values.push(id);
        
        const query = `UPDATE emergency_light_reports SET ${setString}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
        const { rows } = await pool.query(query, values);
        if (rows.length === 0) throw new AppError('Not found', 404);
        res.json(rows[0]);
    } catch (error) { next(error); }
};

export const deleteEmergencyLightReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rowCount } = await pool.query('DELETE FROM emergency_light_reports WHERE id = $1', [id]);
        if (rowCount === 0) throw new AppError('Not found', 404);
        res.status(204).send();
    } catch (error) { next(error); }
};