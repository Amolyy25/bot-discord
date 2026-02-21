const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { checkPermission, isAdmin } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vunmute')
        .setDescription('Redonne la parole à un utilisateur muet sur le serveur (vocal)')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
        .addUserOption(opt => opt.setName('utilisateur').setDescription('L\'utilisateur à démute').setRequired(true)),

    async execute(interaction) {
        if (!checkPermission(interaction.member, 'vunmute') && !isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
        }

        if (!member.voice.channelId) {
            return interaction.reply({ content: `⚠️ ${targetUser.tag} n'est connecté à aucun salon vocal.`, ephemeral: true });
        }

        try {
            await member.voice.setMute(false);
            await interaction.reply(`🔊 **${targetUser.tag}** a retrouvé la parole (serveur).`);
            
            const { logModAction } = require('./utils/logHelper');
            await logModAction(interaction.guild, {
                action: 'VUNMUTE',
                moderator: interaction.user,
                target: targetUser,
                color: 0x00FF00
            }).catch(() => {});
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Erreur lors du démute vocal.', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'vunmute') && !isAdmin(message.member)) {
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
            await member.voice.setMute(false);
            await message.reply(`🔊 **${targetUser.tag}** a retrouvé la parole (serveur).`);
            
            const { logModAction } = require('./utils/logHelper');
            await logModAction(message.guild, {
                action: 'VUNMUTE',
                moderator: message.author,
                target: targetUser,
                color: 0x00FF00
            }).catch(() => {});
        } catch (error) {
            console.error(error);
            message.reply('Erreur lors du démute vocal.');
        }
    }
};
