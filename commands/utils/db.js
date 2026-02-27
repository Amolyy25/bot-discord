const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for some hosted DBs like Railway/Heroku
    }
});

async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS sanctions (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                type TEXT,
                level TEXT,
                moderator TEXT,
                reason TEXT,
                category TEXT,
                gravity TEXT,
                duration TEXT,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMPTZ
            );
        `);
        console.log('[DB] Table sanctions vérifiée/créée.');
    } catch (err) {
        console.error('[DB] Erreur lors de l\'initialisation:', err);
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    initDB,
    query: (text, params) => pool.query(text, params)
};
