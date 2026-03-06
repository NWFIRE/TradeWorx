import fs from 'fs';
import path from 'path';

const tables = [
    { entity: 'EmergencyLightReport', table: 'emergency_light_reports', route: 'emergency-light-reports' },
    { entity: 'FireAlarmReport', table: 'fire_alarm_reports', route: 'fire-alarm-reports' },
    { entity: 'WetChemicalReport', table: 'wet_chemical_reports', route: 'wet-chemical-reports' },
    { entity: 'WetSprinklerReport', table: 'wet_sprinkler_reports', route: 'wet-sprinkler-reports' },
    { entity: 'WorkOrder', table: 'work_orders', route: 'work-orders' },
    { entity: 'WorkOrderDeficiency', table: 'work_order_deficiencies', route: 'work-order-deficiencies' },
];

tables.forEach(({ entity, table, route }) => {
    const controllerCode = `
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export const get${entity}s = async (req, res, next) => {
    try {
        const { inspection_id } = req.query;
        let query = 'SELECT * FROM ${table}';
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

export const get${entity}ById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM ${table} WHERE id = $1', [id]);
        if (rows.length === 0) throw new AppError('Not found', 404);
        res.json(rows[0]);
    } catch (error) { next(error); }
};

export const create${entity} = async (req, res, next) => {
    try {
        // Dynamic insert
        const keys = Object.keys(req.body);
        const values = Object.values(req.body);
        const placeholders = keys.map((_, i) => '$' + (i + 1)).join(', ');
        
        const query = \`INSERT INTO ${table} (\${keys.join(', ')}) VALUES (\${placeholders}) RETURNING *\`;
        const { rows } = await pool.query(query, values);
        res.status(201).json(rows[0]);
    } catch (error) { next(error); }
};

export const update${entity} = async (req, res, next) => {
    try {
        const { id } = req.params;
        const keys = Object.keys(req.body);
        const values = Object.values(req.body);
        
        if (keys.length === 0) return res.json({});
        
        const setString = keys.map((key, i) => \`\${key} = $\${i + 1}\`).join(', ');
        values.push(id);
        
        const query = \`UPDATE ${table} SET \${setString}, updated_at = NOW() WHERE id = $\${values.length} RETURNING *\`;
        const { rows } = await pool.query(query, values);
        if (rows.length === 0) throw new AppError('Not found', 404);
        res.json(rows[0]);
    } catch (error) { next(error); }
};

export const delete${entity} = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rowCount } = await pool.query('DELETE FROM ${table} WHERE id = $1', [id]);
        if (rowCount === 0) throw new AppError('Not found', 404);
        res.status(204).send();
    } catch (error) { next(error); }
};
`;

    const routerCode = `
import { Router } from 'express';
import * as controller from './${entity.toLowerCase()}.js';
import { authenticateJWT, requireRole } from '../middleware/jwtMiddleware.js';

const router = Router();
router.use(authenticateJWT);

router.get('/', controller.get${entity}s);
router.get('/:id', controller.get${entity}ById);
router.post('/', requireRole(['admin', 'manager', 'technician']), controller.create${entity});
router.put('/:id', requireRole(['admin', 'manager', 'technician']), controller.update${entity});
router.delete('/:id', requireRole(['admin']), controller.delete${entity});

export default router;
`;

    fs.writeFileSync(path.join(process.cwd(), 'src', 'api', `${entity.toLowerCase()}.js`), controllerCode.trim());
    fs.writeFileSync(path.join(process.cwd(), 'src', 'api', `${entity.toLowerCase()}Routes.js`), routerCode.trim());
});

console.log('Generated Controllers and Routes');
