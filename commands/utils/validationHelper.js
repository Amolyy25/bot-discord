const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getStaffLevel, ROLES } = require('./permHelper');

const pendingActions = new Map(); // userId -> { action, target, expiresAt }

/**
 * Demande une double validation pour une commande critique
 */
async function requestDoubleValidation(interaction, actionType, target, executeCallback) {
    const userId = interaction.user.id;
    const staffLevel = getStaffLevel(interaction.member);

    // Si c'est l'owner, on bypass (Optionnel, selon les règles du bot)
    if (userId === interaction.guild.ownerId) {
        return executeCallback();
    }

    const embed = new EmbedBuilder()
        .setTitle('🛡️ DOUBLE VALIDATION REQUISE')
        .setColor(0xFFAA00)
        .setDescription(`La commande **${actionType}** sur **${target}** est considérée comme critique.\nUn second membre de **Perm V+** ou **Souverain** doit confirmer cette action.`)
        .setFooter({ text: 'Expiration dans 30 secondes' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_action_${userId}`)
                .setLabel('Confirmer l\'action')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`cancel_action_${userId}`)
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Secondary)
        );

    const response = await interaction.reply({ embeds: [embed], components: [row] });

    const filter = i => {
        // Le second validateur doit être différent de l'initiateur
        // Et il doit avoir le niveau Perm V+ ou Souverain
        return i.user.id !== userId && (i.member.roles.cache.has(ROLES.PERM_5) || i.member.roles.cache.has(ROLES.SOUVERAIN));
    };

    const collector = response.createMessageComponentCollector({ filter, time: 30000 });

    collector.on('collect', async i => {
        if (i.customId === `confirm_action_${userId}`) {
            await i.deferUpdate();
            await executeCallback();
            await i.editReply({ content: `✅ Action confirmée par ${i.user.tag}`, embeds: [], components: [] });
            collector.stop('confirmed');
        } else if (i.customId === `cancel_action_${userId}`) {
            await i.update({ content: `❌ Action annulée par ${i.user.tag}`, embeds: [], components: [] });
            collector.stop('cancelled');
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') {
            await interaction.editReply({ content: '⌛ Temps écoulé, action annulée.', embeds: [], components: [] });
        }
    });
}

/**
 * Version pour les commandes par message (-)
 */
async function requestDoubleValidationMsg(message, actionType, target, executeCallback) {
    const userId = message.author.id;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ DOUBLE VALIDATION REQUISE')
        .setColor(0xFFAA00)
        .setDescription(`La commande **${actionType}** sur **${target}** requiert une confirmation par un autre membre du Staff (Perm V+).`)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_msg_${userId}`)
                .setLabel('Confirmer')
                .setStyle(ButtonStyle.Danger)
        );

    const sent = await message.channel.send({ embeds: [embed], components: [row] });

    const filter = i => i.user.id !== userId && (i.member.roles.cache.has(ROLES.PERM_5) || i.member.roles.cache.has(ROLES.SOUVERAIN));
    const collector = sent.createMessageComponentCollector({ filter, time: 30000 });

    collector.on('collect', async i => {
        await executeCallback();
        await i.update({ content: `✅ Action confirmée par ${i.user.tag}`, embeds: [], components: [] });
        collector.stop('confirmed');
    });
}

module.exports = {
    requestDoubleValidation,
    requestDoubleValidationMsg
};
