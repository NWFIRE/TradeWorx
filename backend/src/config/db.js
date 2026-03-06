import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Force dotenv load for safety against ES import hoisting order
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;

// This will use the DATABASE_URL and DB_SSL from process.env implicitly or explicitly
const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

export const pool = new Pool(dbConfig);

// Keep an eye on errors from the idle clients in the pool
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

