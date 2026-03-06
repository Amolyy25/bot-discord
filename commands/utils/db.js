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

            CREATE TABLE IF NOT EXISTS community_submissions (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                author_id TEXT NOT NULL,
                content TEXT,
                attachment_url TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                validated_at TIMESTAMPTZ,
                validator_id TEXT,
                staff_msg_id TEXT
            );

            CREATE TABLE IF NOT EXISTS community_stats (
                key TEXT PRIMARY KEY,
                value INTEGER DEFAULT 0
            );

            -- Initialisation du compteur de confessions si inexistant
            INSERT INTO community_stats (key, value) VALUES ('confession_count', 0) ON CONFLICT DO NOTHING;

            -- Migrations pour les colonnes existantes (Sentinel v1 -> Sentinel v2)
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_trust' AND column_name='last_daily_update') THEN
                    ALTER TABLE user_trust ADD COLUMN last_daily_update DATE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_trust' AND column_name='invite_count') THEN
                    ALTER TABLE user_trust ADD COLUMN invite_count INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_trust' AND column_name='last_content') THEN
                    ALTER TABLE user_trust ADD COLUMN last_content TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_trust' AND column_name='filtered_count') THEN
                    ALTER TABLE user_trust ADD COLUMN filtered_count INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_trust' AND column_name='muted_until') THEN
                    ALTER TABLE user_trust ADD COLUMN muted_until TIMESTAMPTZ;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_trust' AND column_name='weekly_constructive_count') THEN
                    ALTER TABLE user_trust ADD COLUMN weekly_constructive_count INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_trust' AND column_name='last_bonus_date') THEN
                    ALTER TABLE user_trust ADD COLUMN last_bonus_date TIMESTAMPTZ;
                END IF;
            END $$;
        `);
        console.log('[DB] Tables sanctions, user_trust et community vérifiées/créées.');
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
