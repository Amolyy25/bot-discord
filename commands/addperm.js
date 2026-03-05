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
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('limite')
                .setDescription('Nombre d\'utilisations avant retrait du rôle (optionnel)')
                .setMinValue(1)
                .setRequired(false)),

    async execute(interaction) {
        const commandName = interaction.options.getString('commande').toLowerCase().replace(/^[-!/]+/, '');
        const user = interaction.options.getUser('utilisateur');
        const role = interaction.options.getRole('role');
        const limit = interaction.options.getInteger('limite');

        if (!user && !role) {
            return interaction.reply({ content: '❌ Vous devez spécifier au moins un utilisateur ou un rôle.', flags: 64 });
        }

        if (user) {
            addPermission(commandName, 'user', user.id);
            await interaction.reply({ content: `✅ Permission **${commandName}** accordée à ${user}.`, flags: 64 });
        }

        if (role) {
            addPermission(commandName, 'role', role.id, limit);
            const limitMsg = limit ? ` (Expire après ${limit} utilisation(s))` : '';
            if (user) {
                await interaction.followUp({ content: `✅ Permission **${commandName}** accordée au rôle ${role}${limitMsg}.`, flags: 64 });
            } else {
                await interaction.reply({ content: `✅ Permission **${commandName}** accordée au rôle ${role}${limitMsg}.`, flags: 64 });
            }
        }
    },

    async executeMessage(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Vous n\'avez pas la permission d\'utiliser cette commande.');
        }

        if (args.length < 2) {
            return message.reply('❌ Usage: `-addperm <commande> <@user|@role> [limite]`');
        }

        const commandName = args[0].toLowerCase().replace(/^[-!/]+/, '');
        const user = message.mentions.users.first();
        const role = message.mentions.roles.first();
        
        // Essayer de trouver la limite dans les arguments (le dernier argument si c'est un nombre)
        // Mais attention, l'ID d'un rôle ou user ressemble à un nombre.
        // On suppose que la limite est un petit nombre (ex < 1000) contrairement à un ID discord.
        let limit = null;
        const lastArg = parseInt(args[args.length - 1]);
        if (!isNaN(lastArg) && lastArg < 10000) { // Arbitraire, un ID discord est beaucoup plus grand
            limit = lastArg;
        }

        if (!user && !role) {
             return message.reply('❌ Vous devez mentionner un utilisateur ou un rôle.');
        }

        if (user) {
            addPermission(commandName, 'user', user.id);
            message.reply(`✅ Permission **${commandName}** accordée à ${user}.`);
        }
        
        if (role) {
            addPermission(commandName, 'role', role.id, limit);
            const limitMsg = limit ? ` (Expire après ${limit} utilisation(s))` : '';
            message.reply(`✅ Permission **${commandName}** accordée au rôle ${role}${limitMsg}.`);
        }
    }
};