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
            CREATE TABLE IF NOT EXISTS user_trust (
                user_id TEXT PRIMARY KEY,
                trust_score INTEGER DEFAULT 50,
                total_messages INTEGER DEFAULT 0,
                join_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                is_shadow_muted BOOLEAN DEFAULT FALSE,
                last_bonus_date TIMESTAMPTZ,
                last_daily_update DATE,
                invite_count INTEGER DEFAULT 0,
                last_content TEXT,
                filtered_count INTEGER DEFAULT 0,
                muted_until TIMESTAMPTZ,
                weekly_constructive_count INTEGER DEFAULT 0
            );
        `);
        console.log('[DB] Tables sanctions et user_trust vérifiées/créées.');
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
