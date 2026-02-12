const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addPermission } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addperm')
        .setDescription('Accorde une permission à un utilisateur ou un rôle pour une commande')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('commande')
                .setDescription('Nom de la commande (ex: ban, kick, mute, jackpot...)')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à qui accorder la permission')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Le rôle à qui accorder la permission')
                .setRequired(false)),

    async execute(interaction) {
        const commandName = interaction.options.getString('commande').toLowerCase();
        const user = interaction.options.getUser('utilisateur');
        const role = interaction.options.getRole('role');

        if (!user && !role) {
            return interaction.reply({ content: '❌ Vous devez spécifier au moins un utilisateur ou un rôle.', ephemeral: true });
        }

        if (user) {
            addPermission(commandName, 'user', user.id);
            await interaction.reply({ content: `✅ Permission **${commandName}** accordée à ${user}.`, ephemeral: true });
        }

        if (role) {
            addPermission(commandName, 'role', role.id);
            if (user) {
                await interaction.followUp({ content: `✅ Permission **${commandName}** accordée au rôle ${role}.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `✅ Permission **${commandName}** accordée au rôle ${role}.`, ephemeral: true });
            }
        }
    },

    async executeMessage(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Vous n\'avez pas la permission d\'utiliser cette commande.');
        }

        if (args.length < 2) {
            return message.reply('❌ Usage: `-addperm <commande> <@user|@role>`');
        }

        const commandName = args[0].toLowerCase();
        const user = message.mentions.users.first();
        const role = message.mentions.roles.first();

        if (!user && !role) {
             return message.reply('❌ Vous devez mentionner un utilisateur ou un rôle.');
        }

        if (user) {
            addPermission(commandName, 'user', user.id);
            message.reply(`✅ Permission **${commandName}** accordée à ${user}.`);
        }
        
        if (role) {
            addPermission(commandName, 'role', role.id);
            message.reply(`✅ Permission **${commandName}** accordée au rôle ${role}.`);
        }
    }
};