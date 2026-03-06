import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export const adminReassignInspectionClient = async (req, res, next) => {
    try {
        const { inspectionId, newClientId } = req.body;
        const userId = req.user?.id; // Assuming authenticateJWT middleware

        if (!inspectionId) throw new AppError('Missing inspectionId', 400);
        if (!newClientId) throw new AppError('Missing newClientId', 400);

        const dbClient = await pool.connect();
        try {
            await dbClient.query('BEGIN');

            const { rows: inspections } = await dbClient.query('SELECT * FROM inspections WHERE id = $1', [inspectionId]);
            const inspection = inspections[0];

            if (!inspection) throw new AppError('Inspection not found', 404);

            const oldClientId = inspection.client_id;
            if (!oldClientId) throw new AppError('Inspection has no client_id set', 400);

            if (oldClientId === newClientId) {
                await dbClient.query('ROLLBACK');
                return res.json({ ok: true, message: 'No change needed (already assigned to that client).' });
            }

            const { rows: clients } = await dbClient.query('SELECT id FROM clients WHERE id = $1', [newClientId]);
            if (clients.length === 0) throw new AppError('New client not found', 404);

            // Update Inspection
            await dbClient.query(`
                UPDATE inspections 
                SET client_id = $1, 
                    reassigned_at = NOW(), 
                    reassigned_by_user_id = $2, 
                    reassigned_from_client_id = $3
                WHERE id = $4
            `, [newClientId, userId || null, oldClientId, inspectionId]);

            // Optional history log
            await dbClient.query(`
                INSERT INTO inspection_reassign_history 
                (inspection_id, from_client_id, to_client_id, changed_by_user_id) 
                VALUES ($1, $2, $3, $4)
            `, [inspectionId, oldClientId, newClientId, userId || null]);

            await dbClient.query('COMMIT');

            res.json({
                ok: true,
                message: 'Inspection reassigned to new client.',
                inspectionId,
                fromClientId: oldClientId,
                toClientId: newClientId,
            });

        } catch (error) {
            await dbClient.query('ROLLBACK');
            throw error;
        } finally {
            dbClient.release();
        }
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) throw new AppError('Email is required', 400);

        const { rowCount } = await pool.query('DELETE FROM users WHERE email = $1', [email]);

        if (rowCount === 0) {
            return res.status(404).json({ error: `User with email ${email} not found` });
        }

        // Note: DELETE FROM users will cascade to user_profiles based on our schema setup
        res.json({ success: true, message: `User ${email} profile deleted successfully` });

    } catch (error) {
        logger.error('Error deleting user:', error);
        res.status(500).json({ error: `Failed to delete user: ${error.message}` });
    }
};

export const updateUserRole = async (req, res, next) => {
    try {
        const { email, newRole, clientId } = req.body;

        if (!email || !newRole) throw new AppError('Email and newRole are required', 400);

        const { rows: users } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        const user = users[0];

        if (!user) throw new AppError('User not found', 404);

        const query = clientId
            ? 'UPDATE user_profiles SET role = $1, client_id = $2 WHERE user_id = $3 RETURNING *'
            : 'UPDATE user_profiles SET role = $1 WHERE user_id = $2 RETURNING *';

        const values = clientId ? [newRole, clientId, user.id] : [newRole, user.id];

        const { rowCount } = await pool.query(query, values);

        if (rowCount === 0) throw new AppError('User profile not found', 404);

        res.json({ success: true, message: `User role updated to ${newRole}` });

    } catch (error) {
        next(error);
    }
};

export const syncDeficiencies = async (req, res, next) => {
    try {
        const { rows: inspections } = await pool.query('SELECT * FROM inspections');

        let created = 0;
        let skipped = 0;

        for (const inspection of inspections) {
            // In the new schema, inspections don't inherently have a JSON array of deficiencies 
            // unless added as a legacy JSONB column. Assuming it might have been passed in the body 
            // or the database `inspections` table still holds a `deficiencies` JSONB column for migration.
            const deficienciesArray = inspection.deficiencies || [];

            if (deficienciesArray.length === 0) continue;

            const { rows: existingDeficiencies } = await pool.query('SELECT * FROM deficiencies WHERE inspection_id = $1', [inspection.id]);

            for (const def of deficienciesArray) {
                const exists = existingDeficiencies.some(
                    existing => existing.description === def.description && existing.location === def.location
                );

                if (!exists && def.description) {
                    let severity = 'medium';
                    if (def.severity === 'minor') severity = 'low';
                    else if (def.severity === 'moderate') severity = 'medium';
                    else if (def.severity === 'major') severity = 'high';
                    else if (def.severity === 'critical') severity = 'critical';

                    await pool.query(`
                        INSERT INTO deficiencies 
                        (inspection_id, property_id, client_id, description, severity, location, corrective_action, due_date, status)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [
                        inspection.id,
                        inspection.property_id,
                        inspection.client_id,
                        def.description,
                        severity,
                        def.location || '',
                        def.corrective_action || '',
                        def.due_date || null,
                        'open'
                    ]);
                    created++;
                } else {
                    skipped++;
                }
            }
        }

        res.json({
            success: true,
            message: `Synced deficiencies: ${created} created, ${skipped} skipped`,
            created,
            skipped
        });

    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
};
