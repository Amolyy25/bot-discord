const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Affiche les informations d\'un rôle')
        .addRoleOption(option =>
            option.setName('rôle')
                .setDescription('Le rôle dont vous voulez voir les infos')
                .setRequired(true)),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        if (!checkPermission(interaction.member, 'roleinfo')) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        const role = interaction.options.getRole('rôle');

        const permissions = role.permissions
            .toArray()
            .map(p => p.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase()))
            .slice(0, 15)
            .join(', ');

        const memberCount = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;

        const embed = {
            color: parseInt(role.hexColor.replace('#', ''), 16),
            title: `Informations sur le rôle ${role.name}`,
            fields: [
                { name: 'ID', value: role.id, inline: true },
                { name: 'Couleur', value: role.hexColor.toUpperCase(), inline: true },
                { name: 'Position', value: role.position.toString(), inline: true },
                { name: 'Membres', value: `${memberCount} membre(s)`, inline: true },
                { name: 'Mentionable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
                { name: 'Séparé', value: role.hoist ? 'Oui' : 'Non', inline: true },
                { name: 'Géré', value: role.managed ? 'Oui' : 'Non', inline: true },
                { name: 'Créé le', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'Permissions', value: permissions || 'Aucune permission spéciale', inline: false }
            ],
            timestamp: new Date().toISOString()
        };

        if (role.icon) {
            embed.thumbnail = { url: role.iconURL() };
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message, args) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
        if (!checkPermission(message.member, 'roleinfo')) {
            return message.reply('non ta pas la perm');
        }
        if (!args[0]) {
            return message.reply('Veuillez mentionner ou nommer un rôle!');
        }

        const role = message.mentions.roles.first() ||
            message.guild.roles.cache.get(args[0]) ||
            message.guild.roles.cache.find(r => r.name.toLowerCase() === args.slice(0).join(' ').toLowerCase());

        if (!role) {
            return message.reply('Rôle introuvable!');
        }

        const permissions = role.permissions
            .toArray()
            .map(p => p.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase()))
            .slice(0, 15)
            .join(', ');

        const memberCount = message.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;

        const embed = {
            color: parseInt(role.hexColor.replace('#', ''), 16),
            title: `Informations sur le rôle ${role.name}`,
            fields: [
                { name: 'ID', value: role.id, inline: true },
                { name: 'Couleur', value: role.hexColor.toUpperCase(), inline: true },
                { name: 'Position', value: role.position.toString(), inline: true },
                { name: 'Membres', value: `${memberCount} membre(s)`, inline: true },
                { name: 'Mentionable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
                { name: 'Séparé', value: role.hoist ? 'Oui' : 'Non', inline: true },
                { name: 'Géré', value: role.managed ? 'Oui' : 'Non', inline: true },
                { name: 'Créé le', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'Permissions', value: permissions || 'Aucune permission spéciale', inline: false }
            ],
            timestamp: new Date().toISOString()
        };

        if (role.icon) {
            embed.thumbnail = { url: role.iconURL() };
        }

        message.channel.send({ embeds: [embed] });
    }
};