const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { checkPermission, isAdmin } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vmute')
        .setDescription('Rend un utilisateur muet sur le serveur (vocal)')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
        .addUserOption(opt => opt.setName('utilisateur').setDescription('L\'utilisateur à mute').setRequired(true)),

    async execute(interaction) {
        if (!checkPermission(interaction.member, 'vmute') && !isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'Utilisateur introuvable.', flags: 64 });
        }

        if (!member.voice.channelId) {
            return interaction.reply({ content: `⚠️ ${targetUser.tag} n'est connecté à aucun salon vocal.`, flags: 64 });
        }

        try {
            await member.voice.setMute(true);
            await interaction.reply(`🔇 **${targetUser.tag}** a été rendu muet (serveur).`);
            
            const { logModAction } = require('./utils/logHelper');
            await logModAction(interaction.guild, {
                action: 'VMUTE',
                moderator: interaction.user,
                target: targetUser,
                color: 0xFF0000
            }).catch(() => {});
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Erreur lors du mute vocal.', flags: 64 });
        }
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'vmute') && !isAdmin(message.member)) {
            return message.reply('❌ Vous n\'avez pas la permission.');
        }

        if (!args[0]) {
            return message.reply('❌ Veuillez mentionner un utilisateur ou donner son ID.');
        }

        const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!targetUser) {
            return message.reply('Utilisateur introuvable.');
        }

        const member = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member || !member.voice.channelId) {
            return message.reply(`⚠️ ${targetUser.tag} n'est connecté à aucun salon vocal.`);
        }

        try {
            await member.voice.setMute(true);
            await message.reply(`🔇 **${targetUser.tag}** a été rendu muet (serveur).`);
            
            const { logModAction } = require('./utils/logHelper');
            await logModAction(message.guild, {
                action: 'VMUTE',
                moderator: message.author,
                target: targetUser,
                color: 0xFF0000
            }).catch(() => {});
        } catch (error) {
            console.error(error);
            message.reply('Erreur lors du mute vocal.');
        }
    }
};
