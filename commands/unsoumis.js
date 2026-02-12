const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getUserRoles } = require('./utils/soumisHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unsoumis')
        .setDescription('Rend ses rôles à un utilisateur soumis')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à libérer')
                .setRequired(true)),

    async execute(interaction) {
        const { checkPermission, isPerm3OrAdmin, isModChannel, isAdmin } = require('./utils/permHelper');
        
        // Vérification combinée : 'unsoumis' OU isPerm3OrAdmin
        const hasPerm = checkPermission(interaction.member, 'unsoumis', isPerm3OrAdmin);
        if (!hasPerm) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }

        const adminStatus = isAdmin(interaction.member);
        const isGeneral = interaction.channel.name.toLowerCase().includes('general');
        if (!isModChannel(interaction.channelId) && !isGeneral && !adminStatus) return;
        const target = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ content: 'Utilisateur non trouvé!', ephemeral: true });

        const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'soumis');
        if (!role || !member.roles.cache.has(role.id)) {
            return interaction.reply({ content: 'Cet utilisateur n\'est pas soumis!', ephemeral: true });
        }

        try {
            // Récupérer les anciens rôles
            const oldRoleIds = getUserRoles(interaction.guild.id, target.id);
            
            // Enlever le rôle soumis
            await member.roles.remove(role);

            // Restaurer les anciens rôles
            if (oldRoleIds && oldRoleIds.length > 0) {
                await member.roles.add(oldRoleIds);
            }

            const { logModAction } = require('./utils/logHelper');
            await logModAction(interaction.guild, {
                action: 'UNSOUMIS',
                moderator: interaction.user,
                target: target,
                color: 0x00FF00
            });

            await interaction.reply({ content: `${target} a été libéré et a retrouvé ses rôles !` });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Erreur lors de l\'annulation de la soumission!', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        const { checkPermission, isPerm3OrAdmin, isModChannel, isAdmin } = require('./utils/permHelper');
        
        // Vérification combinée : 'unsoumis' OU isPerm3OrAdmin
        const hasPerm = checkPermission(message.member, 'unsoumis', isPerm3OrAdmin);
        if (!hasPerm) {
            return message.reply('non ta pas la perm');
        }

        const adminStatus = isAdmin(message.member);
        const isGeneral = message.channel.name.toLowerCase().includes('general');
        if (!isModChannel(message.channel.id) && !isGeneral && !adminStatus) return;

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -unsoumis @utilisateur ou ID');

        const member = await message.guild.members.fetch(target.id).catch(() => null);
        if (!member) return message.reply('Utilisateur non trouvé!');

        const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'soumis');
        if (!role || !member.roles.cache.has(role.id)) {
            return message.reply('Cet utilisateur n\'est pas soumis!');
        }

        try {
            const oldRoleIds = getUserRoles(message.guild.id, target.id);
            await member.roles.remove(role);

            if (oldRoleIds && oldRoleIds.length > 0) {
                await member.roles.add(oldRoleIds);
            }

            const { logModAction } = require('./utils/logHelper');
            await logModAction(message.guild, {
                action: 'UNSOUMIS',
                moderator: message.author,
                target: target,
                color: 0x00FF00
            });

            await message.channel.send({ content: `${target} a été libéré et a retrouvé ses rôles !` });
        } catch (error) {
            console.error(error);
            message.reply('Erreur lors de l\'annulation de la soumission!');
        }
    }
};
