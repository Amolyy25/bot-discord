const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Affiche les statistiques du serveur'),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        if (!checkPermission(interaction.member, 'stats')) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        const { guild } = interaction;

        try {
            const totalMembers = guild.memberCount;
            // Utiliser le cache existant au lieu de fetch tout le monde pour l'online count pour éviter les Rate Limits Discord
            const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;
            const boostCount = guild.premiumSubscriptionCount || 0;
            const boostLevel = guild.premiumTier;

            const embed = new EmbedBuilder()
                .setTitle(`<:love:1470917973819658304> Statistiques - ${guild.name}`)
                .setDescription(`*Voici les statistiques du serveur du ${new Date().toLocaleDateString('fr-FR')}*`)
                .addFields(
                    { name: 'Membres', value: `\`${totalMembers}\` membres au total`, inline: true },
                    { name: 'En ligne', value: `\`${onlineMembers}\` membres actifs`, inline: true },
                    { name: 'Boosts', value: `\`${boostCount}\` boosts (Niveau ${boostLevel})`, inline: true }
                )
                .setColor(0xFFFFFF)
                .setFooter({ text: 'LE SECTEUR STATISTIQUES' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur stats:', error);
            await interaction.reply({ content: 'Une erreur est survenue lors de la récupération des statistiques.', ephemeral: true });
        }
    },

    async executeMessage(message) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
        if (!checkPermission(message.member, 'stats')) {
            return message.reply('non ta pas la perm');
        }
        const { guild } = message;

        try {
            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;
            const boostCount = guild.premiumSubscriptionCount || 0;
            const boostLevel = guild.premiumTier;

            const embed = new EmbedBuilder()
                .setTitle(`<:love:1470917973819658304> Statistiques - ${guild.name}`)
                .setDescription(`*Voici les statistiques du serveur du ${new Date().toLocaleDateString('fr-FR')}*`)
                .addFields(
                    { name: 'Membres', value: `\`${totalMembers}\` membres au total`, inline: true },
                    { name: 'En ligne', value: `\`${onlineMembers}\` membres actifs`, inline: true },
                    { name: 'Boosts', value: `\`${boostCount}\` boosts (Niveau ${boostLevel})`, inline: true }
                )
                .setColor(0xFFFFFF)
                .setFooter({ text: 'LE SECTEUR STATISTIQUES' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur stats:', error);
            await message.reply('Une erreur est survenue lors de la récupération des statistiques.');
        }
    }
};
