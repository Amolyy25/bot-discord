const { pool } = require('./db');
const { ROLES, MOD_CHANNEL_ID, ADMIN_PING_ID } = require('./permHelper');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Cache local pour éviter de spam la DB
const trustCache = new Map();
const slowmodeCache = new Map(); // userId -> lastTimestamp

// Configuration des seuils
const SCORE_THRESHOLDS = {
    CRITIQUE: 10,
    HOSTILE: 20,
    SUSPECT: 50,
    NEUTRE: 80
};

// ... (Listes de mots inchangées)

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
                trust_score: 50,
                total_messages: 0,
                is_shadow_muted: false,
                weekly_constructive_count: 0,
                muted_until: null,
                last_daily_update: null
            };
            await pool.query(
                'INSERT INTO user_trust (user_id, trust_score, total_messages, is_shadow_muted) VALUES ($1, $2, $3, $4)',
                [userId, 50, 0, false]
            );
            trustCache.set(userId, newData);
            return newData;
        }
    } catch (err) {
        console.error('[TrustHelper] Erreur getTrustData:', err);
        return { trust_score: 50, is_shadow_muted: false, muted_until: null };
    }
}

/**
 * Vérifie le Slowmode individuel (Score entre 10 et 20)
 */
async function checkIndividualSlowmode(message, score) {
    if (score > 10 && score <= 20) {
        const lastMsg = slowmodeCache.get(message.author.id) || 0;
        const now = Date.now();
        const cooldown = 30 * 1000; // 30 secondes

        if (now - lastMsg < cooldown) {
            await message.delete().catch(() => {});
            
            // Envoyer un seul avertissement en MP tous les X temps pour pas spam
            const lastWarn = slowmodeCache.get(`${message.author.id}_warn`) || 0;
            if (now - lastWarn > 60000) {
                try {
                    await message.author.send(`⚠️ **Lana Sentinel** : Ton score de confiance est bas (**${score}**). Tu peux envoyer un message toutes les 30s le temps de regagner la confiance du secteur.`);
                    slowmodeCache.set(`${message.author.id}_warn`, now);
                } catch (e) {}
            }
            return true; // Bloqué
        }
        slowmodeCache.set(message.author.id, now);
    }
    return false;
}

/**
 * Applique le statut @soumis (Severe Tempmute + Rôle)
 */
async function applySoumis(member, durationHours = 24, reason = 'Automatique Sentinel') {
    const until = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    
    try {
        // 1. Gérer le rôle @soumis
        let soumisRole = member.guild.roles.cache.find(r => r.name.toLowerCase() === 'soumis');
        if (!soumisRole) {
            soumisRole = await member.guild.roles.create({
                name: 'soumis',
                color: '#010101',
                permissions: 0n,
                reason: 'Sentinel auto-create'
            }).catch(() => null);
        }

        // 2. Sauvegarder les rôles et tout retirer
        const { saveUserRoles } = require('./soumisHelper');
        const removableRoles = member.roles.cache.filter(r => r.name !== '@everyone' && !r.managed);
        const roleIds = removableRoles.map(r => r.id);
        
        if (roleIds.length > 0) {
            saveUserRoles(member.guild.id, member.id, roleIds);
            await member.roles.remove(removableRoles).catch(() => {});
        }
        if (soumisRole) await member.roles.add(soumisRole).catch(() => {});

        // 3. Appliquer le timeout Discord (Tempmute sévère)
        await member.timeout(durationHours * 60 * 60 * 1000, reason).catch(() => {});
        
        // 4. Enregistrer en DB
        await pool.query('UPDATE user_trust SET muted_until = $1, trust_score = 30 WHERE user_id = $2', [until, member.id]);
        
        // 5. Log
        const logChannel = member.guild.channels.cache.get(MOD_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ SENTINEL - NEUTRALISATION ACTIVÉE')
                .setColor(0xFF0000)
                .setDescription(`Le membre ${member} a été neutralisé (@soumis).`)
                .addFields(
                    { name: 'Raison', value: reason },
                    { name: 'Durée', value: `${durationHours}h` },
                    { name: 'Impact', value: 'Roles retirés + Timeout.' }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }

        // Mettre à jour le cache
        const data = await getTrustData(member.id);
        data.trust_score = 30;
        data.muted_until = until;
        trustCache.set(member.id, data);
    } catch (err) {
        console.error('[TrustHelper] Erreur applySoumis:', err);
    }
}

/**
 * Met à jour le score et synchronise avec la DB
 */
async function updateTrustScore(guild, userId, change, reason = '') {
    const data = await getTrustData(userId);
    const oldScore = data.trust_score;
    data.trust_score = Math.max(-50, Math.min(100, data.trust_score + change));
    
    console.log(`[TrustScore] ${userId}: ${oldScore} -> ${data.trust_score} (${change > 0 ? '+' : ''}${change}) | Raison: ${reason}`);

    try {
        await pool.query('UPDATE user_trust SET trust_score = $1 WHERE user_id = $2', [data.trust_score, userId]);
        trustCache.set(userId, data);

        // Vérification des seuils critiques
        if (data.trust_score <= 0) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                await applySoumis(member, 24, `Score tombé à ${data.trust_score}: ${reason}`);
            }
        }
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

    // Bonus Ancienneté (5 pts par semaine)
    // Ici calculé à l'entrée c'est bizarre, on devrait le faire au messageCreate ou via un cron.
    // Mais on peut attribuer les points accumulés s'il revient.

    if (scoreChange !== 0) {
        await updateTrustScore(member.guild, member.id, scoreChange, reasons.join(', '));
    }

    // Bonus Rôles
    let roleBonus = 0;
    const { ROLES } = require('./permHelper');
    if (member.roles.cache.has(ROLES.SOUVERAIN)) roleBonus += 20;
    if (member.roles.cache.has('1471431323645378766')) roleBonus += 20; // Rôle "Vérifié"
    if (member.roles.cache.has('1471431323645378767')) roleBonus += 20; // Rôle "Prestige"

    if (roleBonus > 0) await updateTrustScore(member.guild, member.id, roleBonus, 'Bonus Rôles/Vérification');
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
    let reason = '';

    // 1. Liste 2 : Haine Sévère (-40 pts)
    if (HATE_WORDS.some(word => content.includes(word))) {
        scoreChange = -40;
        reason = 'Haine Sévère (Liste 2)';
    } 
    // 2. Vulgarité : Deletion simple
    else if (VULGARITY_WORDS.some(word => content.includes(word))) {
        await message.delete().catch(() => {});
        const warnEmbed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setDescription(`⚠️ ${message.author}, merci de rester poli.`);
        await message.channel.send({ embeds: [warnEmbed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        return; 
    }

    // 3. Ping global (-30 pts)
    if (message.mentions.everyone) {
        scoreChange -= 30;
        reason = reason ? reason + ' + Ping Global' : 'Ping Global';
    }

    if (scoreChange !== 0) {
        await updateTrustScore(message.guild, message.author.id, scoreChange, reason);
    }

    // Bonus de fidélité / constructif
    await handleConstructiveBonus(message);
    await checkSeniorityBonus(message.guild, message.author.id);
    await checkDailyBonus(message.guild, message.author.id);
}

/**
 * Bonus d'ancienneté (+5/semaine)
 */
async function checkSeniorityBonus(guild, userId) {
    const data = await getTrustData(userId);
    const now = Date.now();
    
    // Si on n'a jamais donné de bonus, on initialise à la date de join
    if (!data.last_bonus_date) {
        await pool.query('UPDATE user_trust SET last_bonus_date = join_date WHERE user_id = $1', [userId]);
        data.last_bonus_date = data.join_date;
    }

    const lastBonus = new Date(data.last_bonus_date).getTime();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    if (now - lastBonus >= weekMs) {
        const weeks = Math.floor((now - lastBonus) / weekMs);
        await updateTrustScore(guild, userId, 5 * weeks, `${weeks} semaine(s) d'ancienneté`);
        await pool.query('UPDATE user_trust SET last_bonus_date = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);
        data.last_bonus_date = new Date();
    }
}

/**
 * Bonus d'activité quotidienne (+5 pts)
 */
async function checkDailyBonus(guild, userId) {
    const data = await getTrustData(userId);
    const today = new Date().toISOString().split('T')[0];

    if (data.last_daily_update !== today) {
        await updateTrustScore(guild, userId, 5, 'Activité quotidienne');
        await pool.query('UPDATE user_trust SET last_daily_update = $1 WHERE user_id = $2', [today, userId]);
        data.last_daily_update = today;
        trustCache.set(userId, data);
    }
}

/**
 * Bonus de parrainage (+15 pts)
 */
async function handleInviteBonus(guild, inviterId) {
    if (!inviterId) return;
    await updateTrustScore(guild, inviterId, 15, 'Parrainage (Nouvel arrivant)');
    await pool.query('UPDATE user_trust SET invite_count = invite_count + 1 WHERE user_id = $1', [inviterId]);
}

/**
 * Bonus de bienvenue / Rôles (+10 pts)
 */
async function handleWelcomeRoleBonus(guild, userId) {
    const data = await getTrustData(userId);
    // On ne donne ce bonus qu'une seule fois (on utilise une colonne ou on vérifie si score > base)
    // Pour simplifier, on peut vérifier si total_messages est bas et il n'a pas encore eu ce bonus.
    // Ajoutons un flag en DB plus tard si besoin, pour l'instant un bonus unique.
    if (data.total_messages < 5) { // Simple vérification pour nouveau membre
        await updateTrustScore(guild, userId, 10, 'Onboarding / Choix des rôles');
    }
}

/**
 * Bonus de fidélité et messages constructifs
 */
async function handleConstructiveBonus(message) {
    const data = await getTrustData(message.author.id);
    
    // Protection score farming
    if (message.content.length < 5) return;
    if (data.last_content === message.content) return;

    try {
        await pool.query('UPDATE user_trust SET total_messages = total_messages + 1, last_content = $1 WHERE user_id = $2', [message.content, message.author.id]);
        data.total_messages = (data.total_messages || 0) + 1;
        data.last_content = message.content;

        if (data.total_messages % 100 === 0 && (data.weekly_constructive_count || 0) < 5) {
            await updateTrustScore(message.guild, message.author.id, 2, '100 messages constructifs');
            await pool.query('UPDATE user_trust SET weekly_constructive_count = weekly_constructive_count + 1 WHERE user_id = $2', [message.author.id]);
        }
    } catch (err) {
        console.error('[TrustHelper] Erreur constructive:', err);
    }
}

module.exports = {
    getTrustData,
    updateTrustScore,
    setShadowMute,
    handleNewMemberTrust,
    checkComportementalMalus,
    applySoumis,
    checkIndividualSlowmode,
    handleInviteBonus,
    handleWelcomeRoleBonus,
    trustCache,
    SCORE_THRESHOLDS
};
