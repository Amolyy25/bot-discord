const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { ROLES, MOD_CHANNEL_ID, ADMIN_PING_ID } = require('./permHelper');
const { saveUserRoles } = require('./soumisHelper');
const { logModAction } = require('./logHelper');

// Seuils
const THRESHOLDS = {
    BAN_KICK: { limit: 3, window: 60000 },
    CHANNELS_ROLES: { limit: 2, window: 10000 },
    PROMOTIONS: { limit: 2, window: 300000 },
};

// Stockage des actions (userId -> { banKick: [], channelsRoles: [], promotions: [] })
const staffActions = new Map();

function getStaffData(userId) {
    if (!staffActions.has(userId)) {
        staffActions.set(userId, { banKick: [], channelsRoles: [], promotions: [] });
    }
    return staffActions.get(userId);
}

/**
 * Sanctionne un staff (Anti-Nuke)
 */
async function sanctionStaff(guild, staffMember, reason) {
    if (!staffMember || !staffMember.manageable) return;

    // 1. Sauvegarder les rôles et tout retirer
    const removableRoles = staffMember.roles.cache.filter(r => r.name !== '@everyone' && !r.managed);
    const roleIds = removableRoles.map(r => r.id);
    
    if (roleIds.length > 0) {
        saveUserRoles(guild.id, staffMember.id, roleIds);
        await staffMember.roles.remove(removableRoles).catch(() => {});
    }

    // 2. Appliquer le rôle @soumis
    let soumisRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'soumis');
    if (!soumisRole) {
        soumisRole = await guild.roles.create({
            name: 'soumis',
            color: '#010101',
            permissions: 0n,
            reason: 'Anti-Nuke auto-create'
        }).catch(() => null);
    }
    if (soumisRole) await staffMember.roles.add(soumisRole).catch(() => {});

    // 3. Alerte Direction
    const logChannel = await guild.channels.fetch(MOD_CHANNEL_ID).catch(() => null);
    if (logChannel) {
        const embed = new EmbedBuilder()
            .setTitle('🚨 ALERTE ANTI-NUKE - STAFF SANCTIONNÉ')
            .setColor(0xFF0000)
            .setDescription(`Le staff ${staffMember} a été sanctionné pour une suspicion de **sabotage (NUKE)**.`)
            .addFields(
                { name: 'Raison', value: reason },
                { name: 'Action prise', value: 'Retrait de tous les rôles + Rôle @soumis' }
            )
            .setTimestamp();

        await logChannel.send({ content: `<@&${ADMIN_PING_ID}>`, embeds: [embed] });
    }
}

/**
 * Traite une action effectuée par un staff
 */
async function trackStaffAction(guild, userId, type) {
    if (userId === guild.ownerId) return; // L'owner est immunisé

    const staffMember = await guild.members.fetch(userId).catch(() => null);
    if (!staffMember) return;

    const staffData = getStaffData(userId);
    const now = Date.now();
    const threshold = THRESHOLDS[type];

    if (!threshold) return;

    // Nettoyer les accès obsolètes
    const actionList = type === 'BAN_KICK' ? staffData.banKick : 
                      type === 'CHANNELS_ROLES' ? staffData.channelsRoles : 
                      staffData.promotions;

    // Ajouter l'action
    actionList.push(now);

    // Filtrer par fenêtre
    const recentActions = actionList.filter(t => now - t < threshold.window);
    
    // Mettre à jour la liste filtrée
    if (type === 'BAN_KICK') staffData.banKick = recentActions;
    else if (type === 'CHANNELS_ROLES') staffData.channelsRoles = recentActions;
    else staffData.promotions = recentActions;

    // Vérifier dépassement
    if (recentActions.length > threshold.limit) {
        let reason = '';
        if (type === 'BAN_KICK') reason = `Mass Ban/Kick (${recentActions.length} en 1 min)`;
        if (type === 'CHANNELS_ROLES') reason = `Mass Channel/Role mutations (${recentActions.length} en 10 sec)`;
        if (type === 'PROMOTIONS') reason = `Mass Promotion (${recentActions.length} en 5 min)`;

        await sanctionStaff(guild, staffMember, reason);
    }
}

/**
 * Surveille les Audit Logs
 */
async function checkAuditLogs(guild) {
    try {
        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1 });
        const entry = fetchedLogs.entries.first();
        if (!entry) return;

        const { executorId, action } = entry;
        if (!executorId || executorId === guild.client.user.id) return;

        // Anti-Webhook (Seul l'owner peut créer)
        if (action === AuditLogEvent.WebhookCreate) {
            if (executorId !== guild.ownerId) {
                const staffMember = await guild.members.fetch(executorId).catch(() => null);
                // Supprimer le webhook (on ne peut pas facilement le trouver via l'entrée sans ID précis, mais on sanctionne le staff)
                await sanctionStaff(guild, staffMember, 'Création de Webhook non autorisée');
            }
        }

        // Autres types d'actions suivies via Audit Logs (si non capturées par les événements Discord.js directs)
        // Mais il est préférable d'utiliser les événements pour une réactivité instantanée.
    } catch (e) {
        console.error('[AntiNuke] Erreur AuditLogs:', e);
    }
}

module.exports = {
    trackStaffAction,
    checkAuditLogs,
    sanctionStaff
};
