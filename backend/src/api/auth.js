import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const JWT_EXPIRES_IN = '7d';

export const register = async (req, res, next) => {
    try {
        const { email, password, full_name, display_name } = req.body;

        if (!email || !password) {
            throw new AppError('Email and password are required', 400);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Check if user exists
            const { rows: existingUser } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existingUser.length > 0) {
                throw new AppError('Email is already in use', 400);
            }

            // 2. Hash password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // 3. Create User record
            const { rows: newUser } = await client.query(
                'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name',
                [email, hashedPassword, full_name || email.split('@')[0]]
            );

            const userId = newUser[0].id;

            // 4. Create User Profile
            await client.query(
                `INSERT INTO user_profiles (user_id, display_name, contact_email, role, status) 
                 VALUES ($1, $2, $3, 'user', 'active')`,
                [userId, display_name || full_name, email]
            );

            await client.query('COMMIT');

            // 5. Generate Token
            const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            res.status(201).json({
                success: true,
                token,
                user: newUser[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new AppError('Email and password are required', 400);
        }

        console.log("Login Attempt - Received Email:", `"${email}"`);

        // 1. Fetch user by email
        const { rows: users } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (users.length === 0) {
            throw new AppError('Invalid email or password', 401);
        }

        const user = users[0];

        // 2. Validate password
        // Fallback for migrated schemas that might not have password_hash yet, though ours does
        const isValidPassword = await bcrypt.compare(password, user.password_hash || '');
        if (!isValidPassword) {
            throw new AppError('Invalid email or password', 401);
        }

        // 3. Check if profile is active
        const { rows: profiles } = await pool.query('SELECT status, role FROM user_profiles WHERE user_id = $1', [user.id]);
        if (profiles.length > 0 && profiles[0].status !== 'active') {
            throw new AppError('Account is disabled', 403);
        }

        // 4. Generate token
        // Adding the role to the token payload is helpful
        const userRole = profiles.length > 0 ? profiles[0].role : 'user';
        const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Remove encrypted password from response
        delete user.encrypted_password;

        // Return full info required by Base44's `base44.auth.me()`
        res.json({
            success: true,
            token,
            user: {
                ...user,
                profile: profiles[0] || null
            }
        });
    } catch (error) {
        next(error);
    }
};

export const me = async (req, res, next) => {
    try {
        // req.user is set by authenticateJWT middleware
        const userId = req.user.id;

        const { rows: users } = await pool.query('SELECT id, email, full_name, created_at FROM users WHERE id = $1', [userId]);

        if (users.length === 0) {
            throw new AppError('User not found', 404);
        }

        const { rows: profiles } = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);

        res.json({
            ...users[0],
            profile: profiles[0] || null
        });
    } catch (error) {
        next(error);
    }
};
