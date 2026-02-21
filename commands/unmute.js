const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { clearMutedState } = require('./utils/antispamHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Redonne la parole à un utilisateur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à démuter')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('La raison du unmute')
                .setRequired(false)),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(interaction.member);
        
        // Vérification de permission
        if (!checkPermission(interaction.member, 'unmute')) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        
        if (!isModChannel(interaction.channelId) && !adminStatus) return;

        const target = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
        const member = await interaction.guild.members.fetch(target.id);

        if (!member.moderatable) {
            return interaction.reply({ content: 'Je ne peux pas modérer cet utilisateur!', ephemeral: true });
        }

        try {
            await member.timeout(null, reason);

            clearMutedState(target.id);

            const mutedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'muet' || r.name.toLowerCase() === 'muted');
            if (mutedRole && member.roles.cache.has(mutedRole.id)) {
                await member.roles.remove(mutedRole).catch(() => {});
            }

            const { logModAction } = require('./utils/logHelper');
            await logModAction(interaction.guild, {
                action: 'UNMUTE',
                moderator: interaction.user,
                target: target,
                reason: reason,
                color: 0x00FF00
            });

            const embed = {
                color: 0x00FF00,
                title: 'Utilisateur Unmute',
                thumbnail: { url: target.displayAvatarURL() },
                fields: [
                    { name: 'Utilisateur', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true },
                    { name: 'Raison', value: reason, inline: false }
                ],
                timestamp: new Date().toISOString()
            };

            await interaction.reply({ content: `${target.tag} a été démuté avec succès!`, embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Erreur lors du unmute de l\'utilisateur!', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(message.member);
        
        // Vérification de permission
        if (!checkPermission(message.member, 'unmute')) {
            return message.reply('non ta pas la perm');
        }

        if (!isModChannel(message.channel.id) && !adminStatus) return;

        if (!args[0]) {
            return message.reply('Veuillez mentionner un utilisateur à démuter!');
        }

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) {
            return message.reply('Utilisateur introuvable!');
        }

        const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
        const member = await message.guild.members.fetch(target.id);

        if (!member.moderatable) {
            return message.reply('Je ne peux pas modérer cet utilisateur!');
        }

        try {
            await member.timeout(null, reason);

            clearMutedState(target.id);

            const mutedRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muet' || r.name.toLowerCase() === 'muted');
            if (mutedRole && member.roles.cache.has(mutedRole.id)) {
                await member.roles.remove(mutedRole).catch(() => {});
            }

            const { logModAction } = require('./utils/logHelper');
            await logModAction(message.guild, {
                action: 'UNMUTE',
                moderator: message.author,
                target: target,
                reason: reason,
                color: 0x00FF00
            });

            const embed = {
                color: 0x00FF00,
                title: 'Utilisateur Unmute',
                thumbnail: { url: target.displayAvatarURL() },
                fields: [
                    { name: 'Utilisateur', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Modérateur', value: message.author.tag, inline: true },
                    { name: 'Raison', value: reason, inline: false }
                ],
                timestamp: new Date().toISOString()
            };

            message.channel.send({ content: `${target.tag} a été démuté avec succès!`, embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply('Erreur lors du unmute de l\'utilisateur!');
        }
    }
};