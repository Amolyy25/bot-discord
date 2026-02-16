const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadPermissions } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listperm')
        .setDescription('Liste toutes les permissions accordées via addperm')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Réservé aux admins pour éviter le spam

    async execute(interaction) {
        const perms = loadPermissions();

        if (Object.keys(perms).length === 0) {
            return interaction.reply({ content: '❌ Aucune permission spéciale n\'a été configurée.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des Permissions Spéciales')
            .setColor('#0099ff')
            .setTimestamp()
            .setFooter({ text: 'Géré par permHelper' });

        let hasFields = false;

        for (const [commandName, permData] of Object.entries(perms)) {
            let userList = 'Aucun';
            let roleList = 'Aucun';

            // Formatage des utilisateurs
            if (permData.users && permData.users.length > 0) {
                userList = permData.users.map(id => `<@${id}>`).join(', ');
            }

            // Formatage des rôles avec limites éventuelles
            if (permData.roles && permData.roles.length > 0) {
                roleList = permData.roles.map(id => {
                    const limit = permData.roleLimits && permData.roleLimits[id];
                    const limitText = limit ? ` (Limite: ${limit})` : '';
                    return `<@&${id}>${limitText}`;
                }).join('\n');
            }

            // On n'affiche que si il y a quelque chose
            if ((permData.users && permData.users.length > 0) || (permData.roles && permData.roles.length > 0)) {
                embed.addFields({
                    name: `🔹 Commande: ${commandName}`,
                    value: `**Utilisateurs:** ${userList}\n**Rôles:**\n${roleList}`,
                    inline: false
                });
                hasFields = true;
            }
        }

        if (!hasFields) {
            return interaction.reply({ content: '❌ Aucune permission active trouvée (fichiers vides ou nettoyés).', ephemeral: true });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async executeMessage(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Vous n\'avez pas la permission d\'utiliser cette commande.');
        }

        const perms = loadPermissions();
        if (Object.keys(perms).length === 0) {
            return message.reply('❌ Aucune permission spéciale n\'a été configurée.');
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des Permissions Spéciales')
            .setColor('#0099ff')
            .setTimestamp();

        let hasFields = false;

        for (const [commandName, permData] of Object.entries(perms)) {
            let userList = 'Aucun';
            let roleList = 'Aucun';

            if (permData.users && permData.users.length > 0) {
                userList = permData.users.map(id => `<@${id}>`).join(', ');
            }

            if (permData.roles && permData.roles.length > 0) {
                roleList = permData.roles.map(id => {
                    const limit = permData.roleLimits && permData.roleLimits[id];
                    const limitText = limit ? ` (Limite: ${limit})` : '';
                    return `<@&${id}>${limitText}`;
                }).join('\n'); // Saut de ligne pour lisibilité si plusieurs rôles
            }

            if ((permData.users && permData.users.length > 0) || (permData.roles && permData.roles.length > 0)) {
                embed.addFields({
                    name: `🔹 Commande: ${commandName}`,
                    value: `**Utilisateurs:** ${userList}\n**Rôles:**\n${roleList}`,
                    inline: false
                });
                hasFields = true;
            }
        }

        if (!hasFields) {
            return message.reply('❌ Aucune permission active trouvée.');
        }

        message.reply({ embeds: [embed] });
    }
};