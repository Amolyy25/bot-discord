const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Affiche les informations du serveur'),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        if (!checkPermission(interaction.member, 'serverinfo')) {
            return interaction.reply({ content: 'non ta pas la perm', flags: 64 });
        }
        const guild = interaction.guild;

        const totalMembers = guild.memberCount;
        const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const roles = guild.roles.cache.size - 1; // -1 pour @everyone
        const emojis = guild.emojis.cache.size;
        const boosts = guild.premiumSubscriptionCount;
        const boostLevel = guild.premiumTier;

        const verificationLevels = ['Aucune', 'Faible', 'Moyenne', 'Élevée', 'Très élevée'];
        const contentFilterLevels = ['Désactivé', 'Membres sans rôle', 'Tous les membres'];
        const mfaLevels = ['Désactivé', 'Activé'];

        const embed = {
            color: 0x5865F2,
            title: `Informations sur ${guild.name}`,
            thumbnail: { url: guild.iconURL({ size: 4096, dynamic: true }) },
            description: guild.description || 'Aucune description',
            fields: [
                { name: 'ID', value: guild.id, inline: true },
                { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'Membres', value: `${totalMembers} total\n${onlineMembers} en ligne`, inline: true },
                { name: 'Salons', value: `${textChannels} textuel(s)\n${voiceChannels} vocal(aux)\n${categories} catégorie(s)`, inline: true },
                { name: 'Rôles', value: `${roles} rôle(s)`, inline: true },
                { name: 'Emojis', value: `${emojis} emoji(s)`, inline: true },
                { name: 'Boosts', value: `Niveau ${boostLevel}\n${boosts} boost(s)`, inline: true },
                { name: 'Vérification', value: verificationLevels[guild.verificationLevel], inline: true },
                { name: 'Filtre de contenu', value: contentFilterLevels[guild.explicitContentFilter], inline: true },
                { name: '2FA', value: mfaLevels[guild.mfaLevel], inline: true },
            ],
            timestamp: new Date().toISOString()
        };

        if (guild.bannerURL()) {
            embed.image = { url: guild.bannerURL({ size: 4096 }) };
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
        if (!checkPermission(message.member, 'serverinfo')) {
            return message.reply('non ta pas la perm');
        }
        const guild = message.guild;

        const totalMembers = guild.memberCount;
        const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const roles = guild.roles.cache.size - 1;
        const emojis = guild.emojis.cache.size;
        const boosts = guild.premiumSubscriptionCount;
        const boostLevel = guild.premiumTier;

        const verificationLevels = ['Aucune', 'Faible', 'Moyenne', 'Élevée', 'Très élevée'];
        const contentFilterLevels = ['Désactivé', 'Membres sans rôle', 'Tous les membres'];
        const mfaLevels = ['Désactivé', 'Activé'];

        const embed = {
            color: 0x5865F2,
            title: `Informations sur ${guild.name}`,
            thumbnail: { url: guild.iconURL({ size: 4096, dynamic: true }) },
            description: guild.description || 'Aucune description',
            fields: [
                { name: 'ID', value: guild.id, inline: true },
                { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'Membres', value: `${totalMembers} total\n${onlineMembers} en ligne`, inline: true },
                { name: 'Salons', value: `${textChannels} textuel(s)\n${voiceChannels} vocal(aux)\n${categories} catégorie(s)`, inline: true },
                { name: 'Rôles', value: `${roles} rôle(s)`, inline: true },
                { name: 'Emojis', value: `${emojis} emoji(s)`, inline: true },
                { name: 'Boosts', value: `Niveau ${boostLevel}\n${boosts} boost(s)`, inline: true },
                { name: 'Vérification', value: verificationLevels[guild.verificationLevel], inline: true },
                { name: 'Filtre de contenu', value: contentFilterLevels[guild.explicitContentFilter], inline: true },
                { name: '2FA', value: mfaLevels[guild.mfaLevel], inline: true },
            ],
            timestamp: new Date().toISOString()
        };

        if (guild.bannerURL()) {
            embed.image = { url: guild.bannerURL({ size: 4096 }) };
        }

        message.channel.send({ embeds: [embed] });
    }
};