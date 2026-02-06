const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Affiche les informations d\'un utilisateur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur dont vous voulez voir les infos')
                .setRequired(false)),

    async execute(interaction) {
        const { isPerm3OrAdmin, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        if (!isPerm3OrAdmin(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        const user = interaction.options.getUser('utilisateur') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        const roles = member ? member.roles.cache
            .filter(role => role.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, 10)
            .join(', ') : 'Aucun rôle';

        const permissions = member ? member.permissions.toArray().slice(0, 10).join(', ') : 'N/A';
        const hasNitro = user.premiumSince ? 'Oui' : 'Non';

        const color = member ? parseInt(member.displayHexColor.replace('#', ''), 16) : 0x5865F2;

        const embed = {
            color: color,
            title: `Informations sur ${user.tag}`,
            thumbnail: { url: user.displayAvatarURL({ size: 4096, dynamic: true }) },
            fields: [
                { name: 'ID', value: user.id, inline: true },
                { name: 'Créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'Nitro', value: hasNitro, inline: true },
            ],
            timestamp: new Date().toISOString()
        };

        if (member) {
            embed.fields.push(
                { name: 'Rejoint le', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`, inline: true },
                { name: 'Surnom', value: member.nickname || 'Aucun', inline: true },
                { name: 'Boost', value: member.premiumSince ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:F>` : 'Non', inline: true },
                { name: 'Rôles', value: roles || 'Aucun rôle', inline: false },
                { name: 'Permissions', value: permissions, inline: false }
            );
            embed.footer = { text: `Couleur du rôle: ${member.displayHexColor}` };
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message, args) {
        const { isPerm3OrAdmin, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
        if (!isPerm3OrAdmin(message.member)) {
            return message.reply('non ta pas la perm');
        }
        let user = message.mentions.users.first();
        
        if (!user && args[0]) {
            user = await message.client.users.fetch(args[0]).catch(() => null);
        }
        
        if (!user) user = message.author;

        const member = await message.guild.members.fetch(user.id).catch(() => null);

        const roles = member ? member.roles.cache
            .filter(role => role.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, 10)
            .join(', ') : 'Aucun rôle';

        const permissions = member ? member.permissions.toArray().slice(0, 10).join(', ') : 'N/A';
        const hasNitro = user.premiumSince ? 'Oui' : 'Non';

        const color = member ? parseInt(member.displayHexColor.replace('#', ''), 16) : 0x5865F2;

        const embed = {
            color: color,
            title: `Informations sur ${user.tag}`,
            thumbnail: { url: user.displayAvatarURL({ size: 4096, dynamic: true }) },
            fields: [
                { name: 'ID', value: user.id, inline: true },
                { name: 'Créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'Nitro', value: hasNitro, inline: true },
            ],
            timestamp: new Date().toISOString()
        };

        if (member) {
            embed.fields.push(
                { name: 'Rejoint le', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`, inline: true },
                { name: 'Surnom', value: member.nickname || 'Aucun', inline: true },
                { name: 'Boost', value: member.premiumSince ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:F>` : 'Non', inline: true },
                { name: 'Rôles', value: roles || 'Aucun rôle', inline: false },
                { name: 'Permissions', value: permissions, inline: false }
            );
            embed.footer = { text: `Couleur du rôle: ${member.displayHexColor}` };
        }

        message.channel.send({ embeds: [embed] });
    }
};