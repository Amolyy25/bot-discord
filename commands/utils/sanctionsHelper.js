const fs = require('fs');
const path = require('path');
const { query } = require('./db');

const sanctionsPath = path.join(__dirname, '../../sanctions.json');

const INFRACTION_CONFIG = {
    'Spam': {
        '1': { label: 'Flood léger', duration: '5m' },
        '2': { label: 'Spam intensif', duration: '30m' },
        '3': { label: 'Spam malveillant/Liens', duration: '2h' }
    },
    'Troll': {
        '1': { label: 'Comportement agaçant', duration: '10m' },
        '2': { label: 'Provocations répétés', duration: '1h' },
        '3': { label: 'Troll destructeur / Raid', duration: '6h' }
    },
    'Mentions': {
        '1': { label: 'Mentions abusives (< 5)', duration: '10m' },
        '2': { label: 'Mentions abusives (5 - 10)', duration: '1h' },
        '3': { label: 'Mass Mentions (> 10)', duration: '1d' }
    },
    'Insulte': {
        '1': { label: 'Langage familier', duration: '10m' },
        '2': { label: 'Embrouille en public', duration: '15m' },
        '3': { label: 'Insulte directe', duration: '20m' },
        '4': { label: 'Insulte grave / Harcèlement', duration: '1h' }
    },
    'Propos déplacés': {
        '1': { label: 'Propos choquant', duration: '15m' },
        '2': { label: 'Propos dérangeant', duration: '20m' },
        '3': { label: 'Propos à caractère sexuelle, mysogine etc', duration: '30m' }
    },
    'Autre': {
        '1': { label: 'Infraction mineure', duration: '5m' },
        '2': { label: 'Infraction notable', duration: '30m' },
        '3': { label: 'Infraction majeure', duration: '4h' }
    },
    'Politique': {
        '1': { label: 'Débats politiques', duration: '15m' },
        '2': { label: 'Propagande / Militantisme', duration: '1h' },
        '3': { label: 'Propos extrêmes / Incitation', duration: '4h' }
    },
    'Soumis': {
        '1': { label: 'Soumission', duration: 'instantané' }
    }
};

function parseDuration(durationStr) {
    if (!durationStr) return null;
    const units = {
        's': 1000,
        'm': 60000,
        'h': 3600000,
        'd': 86400000,
        'w': 604800000
    };
    const match = durationStr.match(/^(\d+)([smhdw])$/i);
    if (!match) return null;
    return parseInt(match[1]) * units[match[2].toLowerCase()];
}

/**
 * Charge les sanctions depuis la DB
 */
async function loadSanctionsDB(guildId, userId) {
    try {
        const res = await query(
            'SELECT * FROM sanctions WHERE guild_id = $1 AND user_id = $2 ORDER BY timestamp DESC',
            [guildId, userId]
        );
        return res.rows.map(row => ({
            type: row.type,
            level: row.level,
            moderator: row.moderator,
            reason: row.reason,
            category: row.category,
            gravity: row.gravity,
            duration: row.duration,
            timestamp: row.timestamp,
            expiresAt: row.expires_at
        }));
    } catch (err) {
        console.error('[SanctionsHelper] Erreur loadSanctionsDB:', err);
        return [];
    }
}

/**
 * Ajoute une sanction dans la DB
 */
async function addSanction(guildId, userId, type, level, moderator, reason, category, gravityLabel, customDuration = null) {
    const duration = customDuration || (INFRACTION_CONFIG[category] && INFRACTION_CONFIG[category][level] ? INFRACTION_CONFIG[category][level].duration : 'instantané');
    let expiresAt = null;

    if (duration && duration !== 'permanent' && duration !== 'instantané') {
        const ms = parseDuration(duration);
        if (ms) {
            expiresAt = new Date(Date.now() + ms).toISOString();
        }
    }

    try {
        const res = await query(
            `INSERT INTO sanctions (guild_id, user_id, type, level, moderator, reason, category, gravity, duration, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [guildId, userId, type, level, moderator, reason || gravityLabel, category, gravityLabel, duration, expiresAt]
        );
        return res.rows[0];
    } catch (err) {
        console.error('[SanctionsHelper] Erreur addSanction:', err);
        return null;
    }
}

/**
 * Supprime les sanctions d'un utilisateur
 */
async function clearUserSanctions(guildId, userId) {
    try {
        await query('DELETE FROM sanctions WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
    } catch (err) {
        console.error('[SanctionsHelper] Erreur clearUserSanctions:', err);
    }
}

/**
 * Migration JSON -> DB
 */
async function migrateSanctions() {
    if (!fs.existsSync(sanctionsPath)) return;
    
    try {
        const data = JSON.parse(fs.readFileSync(sanctionsPath, 'utf8'));
        let count = 0;

        for (const guildId in data) {
            for (const userId in data[guildId]) {
                const userSanctions = data[guildId][userId];
                for (const s of userSanctions) {
                    // Vérifier si déjà existant pour éviter les doublons lors de migrations multiples
                    const existing = await query(
                        'SELECT id FROM sanctions WHERE guild_id = $1 AND user_id = $2 AND timestamp = $3',
                        [guildId, userId, s.timestamp]
                    );

                    if (existing.rows.length === 0) {
                        await query(
                            `INSERT INTO sanctions (guild_id, user_id, type, level, moderator, reason, category, gravity, duration, timestamp, expires_at)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                            [guildId, userId, s.type, s.level, s.moderator, s.reason, s.category, s.gravity, s.duration, s.timestamp, s.expiresAt]
                        );
                        count++;
                    }
                }
            }
        }

        if (count > 0) {
            console.log(`[SanctionsHelper] Migration terminée: ${count} sanctions importées.`);
            // On renomme le fichier au lieu de le supprimer pour plus de sécurité
            fs.renameSync(sanctionsPath, sanctionsPath + '.bak');
        }
    } catch (err) {
        console.error('[SanctionsHelper] Erreur migration:', err);
    }
}

module.exports = {
    INFRACTION_CONFIG,
    parseDuration,
    loadSanctionsDB,
    addSanction,
    clearUserSanctions,
    migrateSanctions
};