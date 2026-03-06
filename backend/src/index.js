import { createApp } from './app.js';
import { validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { pool } from './config/db.js';

const startServer = async () => {
    try {
        validateEnv();

        const client = await pool.connect();
        logger.info('Connected to PostgreSQL Database.');
        client.release();

        const app = createApp();
        const PORT = process.env.PORT || 3001;

        app.listen(PORT, () => {
            logger.info(`NW FIRE Mobile Functions API running on port ${PORT}`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
