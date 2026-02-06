const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Affiche les statistiques du serveur'),

    async execute(interaction) {
        const { isPerm3OrAdmin, isModChannel } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId)) return;
        if (!isPerm3OrAdmin(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        const { guild } = interaction;

        try {
            // Fetch members to get accurate counts
            await guild.members.fetch();
            
            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;
            const boostCount = guild.premiumSubscriptionCount || 0;
            const boostLevel = guild.premiumTier;

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📊 Stats - ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: '👥 Membres', value: `${totalMembers}`, inline: true },
                    { name: '🟢 En ligne', value: `${onlineMembers}`, inline: true },
                    { name: '🚀 Boosts', value: `${boostCount} (Niveau ${boostLevel})`, inline: true }
                )
                .setFooter({ text: 'Bot Discord - Statistiques' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur stats:', error);
            await interaction.reply({ content: 'Une erreur est survenue lors de la récupération des statistiques.', ephemeral: true });
        }
    },

    async executeMessage(message) {
        const { isPerm3OrAdmin, isModChannel } = require('./utils/permHelper');
        if (isModChannel(message.channel.id)) return;
        if (!isPerm3OrAdmin(message.member)) {
            return message.reply('non ta pas la perm');
        }
        const { guild } = message;

        try {
            await guild.members.fetch();
            
            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;
            const boostCount = guild.premiumSubscriptionCount || 0;
            const boostLevel = guild.premiumTier;

            const embed = {
                color: 0x5865F2,
                title: `📊 Stats - ${guild.name}`,
                thumbnail: { url: guild.iconURL({ dynamic: true }) },
                fields: [
                    { name: '👥 Membres', value: `${totalMembers}`, inline: true },
                    { name: '🟢 En ligne', value: `${onlineMembers}`, inline: true },
                    { name: '🚀 Boosts', value: `${boostCount} (Niveau ${boostLevel})`, inline: true }
                ],
                footer: { text: 'Bot Discord - Statistiques' },
                timestamp: new Date().toISOString()
            };

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Erreur stats:', error);
            await message.reply('Une erreur est survenue lors de la récupération des statistiques.');
        }
    }
};
