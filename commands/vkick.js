const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { checkPermission, isAdmin } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vkick')
        .setDescription('Déconnecte un utilisateur de son salon vocal')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .addUserOption(opt => opt.setName('utilisateur').setDescription('L\'utilisateur à déconnecter').setRequired(true)),

    async execute(interaction) {
        if (!checkPermission(interaction.member, 'vkick') && !isAdmin(interaction.member)) {
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
            await member.voice.disconnect();
            await interaction.reply(`👢 **${targetUser.tag}** a été déconnecté du vocal.`);
            
            const { logModAction } = require('./utils/logHelper');
            await logModAction(interaction.guild, {
                action: 'VKICK',
                moderator: interaction.user,
                target: targetUser,
                color: 0xFF8C00
            }).catch(() => {});
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Erreur lors de la déconnexion vocale.', flags: 64 });
        }
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'vkick') && !isAdmin(message.member)) {
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
            await member.voice.disconnect();
            await message.reply(`👢 **${targetUser.tag}** a été déconnecté du vocal.`);
            
            const { logModAction } = require('./utils/logHelper');
            await logModAction(message.guild, {
                action: 'VKICK',
                moderator: message.author,
                target: targetUser,
                color: 0xFF8C00
            }).catch(() => {});
        } catch (error) {
            console.error(error);
            message.reply('Erreur lors de la déconnexion vocale.');
        }
    }
};
