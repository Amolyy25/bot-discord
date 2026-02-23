const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const ACTIVITY_FILE = path.join(__dirname, '../../activityData.json');

/**
 * Charge les données d'activité depuis le fichier JSON.
 */
function loadActivityData() {
    try {
        if (!fs.existsSync(ACTIVITY_FILE)) {
            return { users: {} };
        }
        const data = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
        return data || { users: {} };
    } catch (error) {
        console.error('[Activity] Erreur chargement JSON:', error);
        return { users: {} };
    }
}

/**
 * Sauvegarde les données d'activité dans le fichier JSON.
 */
function saveActivityData(data) {
    try {
        fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('[Activity] Erreur sauvegarde JSON:', error);
    }
}

/**
 * Incrémente le compteur de messages pour un utilisateur.
 */
function trackMessage(userId) {
    const data = loadActivityData();
    if (!data.users[userId]) {
        data.users[userId] = 0;
    }
    data.users[userId]++;
    saveActivityData(data);
}

/**
 * Récupère le Top X des membres les plus actifs.
 */
async function getTopActive(guild, limit = 3) {
    const data = loadActivityData();
    const sortedUsers = Object.entries(data.users)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit);

    const topList = [];
    for (let i = 0; i < sortedUsers.length; i++) {
        const [userId, count] = sortedUsers[i];
        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            const name = member ? member.displayName : `Utilisateur inconnu (${userId})`;
            topList.push({ name, count, userId });
        } catch (error) {
            topList.push({ name: `ID: ${userId}`, count, userId });
        }
    }
    return topList;
}

/**
 * Réinitialise les statistiques d'activité.
 */
function resetMonthlyStats() {
    saveActivityData({ users: {} });
    console.log('[Activity] Statistiques mensuelles réinitialisées.');
}

/**
 * Génère un bel embed pour le Top 3.
 */
function createTopEmbed(topList, guildName) {
    const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle(`Top 3 - ${guildName}`)
        .setDescription('Félicitations aux membres les plus actifs ce mois-ci ! 🚀')
        .setTimestamp();

    if (topList.length === 0) {
        embed.setDescription('Aucune activité enregistrée pour le moment.');
    } else {
        let description = '';
        topList.forEach((user, index) => {
            description += `${user.name} : ${user.count} messages\n`;
        });
        embed.setDescription(description);
    }

    return embed;
}

module.exports = {
    trackMessage,
    getTopActive,
    resetMonthlyStats,
    createTopEmbed
};
