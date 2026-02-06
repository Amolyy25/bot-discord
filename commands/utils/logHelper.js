const { EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1469071693644431493';

/**
 * Logs a moderation action to the specified log channel
 * @param {import('discord.js').Guild} guild The guild where the action took place
 * @param {Object} logData Data for the log embed
 * @param {string} logData.action The action performed (e.g., "BAN", "MUTE")
 * @param {import('discord.js').User} logData.moderator The moderator who performed the action
 * @param {import('discord.js').User} [logData.target] The user who was the target of the action
 * @param {string} [logData.reason] The reason for the action
 * @param {string} [logData.details] Extra details (duration, message count, etc.)
 * @param {number} [logData.color] Color of the embed
 */
async function logModAction(guild, logData) {
    const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) {
        console.error(`Log channel ${LOG_CHANNEL_ID} not found!`);
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`Log: ${logData.action}`)
        .setColor(logData.color || 0x5865F2)
        .addFields(
            { name: 'Modérateur', value: `${logData.moderator.tag} (${logData.moderator.id})`, inline: false }
        )
        .setTimestamp();

    if (logData.target) {
        embed.addFields({ name: 'Cible', value: `${logData.target.tag} (${logData.target.id})`, inline: false });
        embed.setThumbnail(logData.target.displayAvatarURL());
    }

    if (logData.reason) {
        embed.addFields({ name: 'Raison', value: logData.reason, inline: false });
    }

    if (logData.details) {
        embed.addFields({ name: 'Détails', value: logData.details, inline: false });
    }

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Failed to send log:', error);
    }
}

module.exports = { logModAction };
