import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const email = 'manish.goyal@fonixtech.io';
  // Check if exists
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (rows.length > 0) {
    console.log('User already exists. Updating password.');
    const passwordHash = await bcrypt.hash('911@Admin007', 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [passwordHash, rows[0].id]);
    console.log('Updated user.');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash('911@Admin007', 10);
  
  const query = `
    INSERT INTO users (email, password, role) 
    VALUES ($1, $2, 'admin') 
    RETURNING id
  `;
  
  try {
    const res = await pool.query(query, [email, passwordHash]);
    const userId = res.rows[0].id;
    
    // Also create profile
    await pool.query(
      'INSERT INTO user_profiles (user_id, first_name, last_name) VALUES ($1, $2, $3)',
      [userId, 'Manish', 'Goyal']
    );
    
    console.log('Successfully created test user.');
  } catch (err) {
    console.error('Error creating user', err);
  } finally {
    process.exit(0);
  }
}

main();
