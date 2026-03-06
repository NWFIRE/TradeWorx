import dotenv from 'dotenv';
import path from 'path';

// Load variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_ACCESS_EXPIRY',
    'JWT_REFRESH_EXPIRY',
    'PORT'
];

export function validateEnv() {
    const missingVars = [];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missingVars.push(envVar);
        }
    }

    if (missingVars.length > 0) {
        throw new Error(`Missing mandatory environment variables: ${missingVars.join(', ')}`);
    }

    console.log('[Env] Environment variables validated successfully.');
}
