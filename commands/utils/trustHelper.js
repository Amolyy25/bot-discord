const { pool } = require('./db');
const { ROLES, MOD_CHANNEL_ID } = require('./permHelper');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Cache local pour éviter de spam la DB
const trustCache = new Map();

// Configuration des seuils
const SCORE_THRESHOLDS = {
    HOSTILE: 20,
    SUSPECT: 50,
    NEUTRE: 80
};

/**
 * Initialise ou récupère le score d'un utilisateur
 */
async function getTrustData(userId) {
    if (trustCache.has(userId)) return trustCache.get(userId);

    try {
        const res = await pool.query('SELECT * FROM user_trust WHERE user_id = $1', [userId]);
        if (res.rows.length > 0) {
            trustCache.set(userId, res.rows[0]);
            return res.rows[0];
        } else {
            const newData = {
                user_id: userId,
                trust_score: 30,
                total_messages: 0,
                is_shadow_muted: false,
                weekly_constructive_count: 0
            };
            await pool.query(
                'INSERT INTO user_trust (user_id, trust_score, total_messages, is_shadow_muted) VALUES ($1, $2, $3, $4)',
                [userId, 30, 0, false]
            );
            trustCache.set(userId, newData);
            return newData;
        }
    } catch (err) {
        console.error('[TrustHelper] Erreur getTrustData:', err);
        return { trust_score: 30, is_shadow_muted: false };
    }
}

/**
 * Met à jour le score et synchronise avec la DB
 */
async function updateTrustScore(userId, change, reason = '') {
    const data = await getTrustData(userId);
    const oldScore = data.trust_score;
    data.trust_score = Math.max(0, Math.min(100, data.trust_score + change));
    
    console.log(`[TrustScore] ${userId}: ${oldScore} -> ${data.trust_score} (${change > 0 ? '+' : ''}${change}) | Raison: ${reason}`);

    try {
        await pool.query('UPDATE user_trust SET trust_score = $1 WHERE user_id = $2', [data.trust_score, userId]);
        trustCache.set(userId, data);
    } catch (err) {
        console.error('[TrustHelper] Erreur updateTrustScore:', err);
    }
}

/**
 * Gère le Shadow Mute
 */
async function setShadowMute(userId, status) {
    const data = await getTrustData(userId);
    data.is_shadow_muted = status;
    try {
        await pool.query('UPDATE user_trust SET is_shadow_muted = $1 WHERE user_id = $2', [status, userId]);
        trustCache.set(userId, data);
    } catch (err) {
        console.error('[TrustHelper] Erreur setShadowMute:', err);
    }
}

/**
 * Logique de calcul à l'entrée (Malus d'entrée)
 */
async function handleNewMemberTrust(member) {
    if (member.user.bot) return;

    let scoreChange = 0;
    const reasons = [];

    // Compte < 7 jours
    const accountAge = Date.now() - member.user.createdTimestamp;
    if (accountAge < 7 * 24 * 60 * 60 * 1000) {
        scoreChange -= 20;
        reasons.push('Compte récent (<7j)');
    }

    // Pas d'avatar personnalisé
    if (!member.user.avatar) {
        scoreChange -= 10;
        reasons.push('Pas d\'avatar');
    }

    // Pseudo suspect (caractères invisibles ou > 5 chiffres)
    const invisibleChars = /[\u17b4\u17b5\u200b\u200c\u200d\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2060\u2061\u2062\u2063\u2064\u206a\u206b\u206c\u206d\u206e\u206f\ufeff]/;
    const digitsCount = (member.displayName.match(/\d/g) || []).length;
    if (invisibleChars.test(member.displayName) || digitsCount > 5) {
        scoreChange -= 15;
        reasons.push('Pseudo suspect');
    }

    if (scoreChange !== 0) {
        await updateTrustScore(member.id, scoreChange, reasons.join(', '));
    }
}

/**
 * Malus comportementaux (En temps réel)
 */
async function checkComportementalMalus(message) {
    if (message.author.bot || !message.guild) return;
    
    // Ignorer Owner/Admin
    if (message.author.id === message.guild.ownerId || message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

    const content = message.content.toLowerCase();
    let scoreChange = 0;
    const reasons = [];

    // 1. Toxic Filter (Simple/Basic list, user can expand)
    const toxicWords = ['connard', 'salope', 'fdp', 'pute', 'encule', 'nique']; // Exemples
    if (toxicWords.some(word => content.includes(word))) {
        scoreChange -= 5;
        reasons.push('Mot toxique');
    }

    // 2. Ping @everyone / @here
    if (message.mentions.everyone) {
        scoreChange -= 30;
        reasons.push('Ping global');
    }

    // 3. Envoi de lien (si score < 50)
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    if (linkRegex.test(content)) {
        const data = await getTrustData(message.author.id);
        if (data.trust_score < 50) {
            scoreChange -= 10;
            reasons.push('Lien (Score < 50)');
        }
    }

    if (scoreChange !== 0) {
        await updateTrustScore(message.author.id, scoreChange, reasons.join(', '));
    }

    // Bonus de fidélité / constructif
    await handleConstructiveBonus(message);
}

/**
 * Bonus de fidélité et messages constructifs
 */
async function handleConstructiveBonus(message) {
    const data = await getTrustData(message.author.id);
    
    // Protection score farming
    if (message.content.length < 5) return;
    if (data.last_content === message.content) return; // Même message que le précédent

    // Incrémenter messages et bonus
    try {
        await pool.query('UPDATE user_trust SET total_messages = total_messages + 1, last_content = $1 WHERE user_id = $2', [message.content, message.author.id]);
        data.total_messages += 1;
        data.last_content = message.content;

        // Tranche de 100 messages constructifs: +2 pts (Max 10/semaine)
        if (data.total_messages % 100 === 0 && (data.weekly_constructive_count || 0) < 5) {
            await updateTrustScore(message.author.id, 2, '100 messages constructifs');
            await pool.query('UPDATE user_trust SET weekly_constructive_count = weekly_constructive_count + 1 WHERE user_id = $2', [message.author.id]);
        }
    } catch (err) {
        console.error('[TrustHelper] Erreur constructive:', err);
    }
}

/**
 * Bonus de fidélité hebdomadaire (Cron ou lors de l'activité)
 */
async function applyWeeklyFidelity(guild) {
    // Cette fonction serait appelée par un cron job
    try {
        const res = await pool.query('SELECT user_id, join_date FROM user_trust');
        for (const row of res.rows) {
            const weeks = Math.floor((Date.now() - new Date(row.join_date)) / (7 * 24 * 60 * 60 * 1000));
            if (weeks > 0) {
                // On pourrait stocker la dernière date de bonus fidelity pour ne donner qu'une fois par semaine
                // Pour simplifier cette version, on laisse la logique métier ici.
            }
        }
    } catch (err) {}
}

module.exports = {
    getTrustData,
    updateTrustScore,
    setShadowMute,
    handleNewMemberTrust,
    checkComportementalMalus,
    applyWeeklyFidelity,
    SCORE_THRESHOLDS
};
