const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste des commandes du bot'),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        if (!checkPermission(interaction.member, 'help')) {
            return interaction.reply({ content: 'non ta pas la perm', flags: 64 });
        }
        const embed = {
            color: 0x5865F2,
            title: 'Liste des Commandes',
            description: 'Voici toutes les commandes disponibles avec le préfixe `-` ou en slash:',
            fields: [
                {
                    name: 'Utilitaires',
                    value: '`-snipe` | `/snipe` - Message supprimé\n`-pic` | `/pic` - Photo de profil\n`-banner` | `/banner` - Bannière utilisateur\n`-fake` | `/fake` - Détecter les fakes (Screen Google)\n`-userinfo` | `/userinfo` - Infos utilisateur\n`-serverinfo` | `/serverinfo` - Infos serveur\n`-roleinfo` | `/roleinfo` - Infos rôle\n`-ping` | `/ping` - Latence\n`-stats` | `/stats` - Statistiques serveur',
                    inline: false
                },
                {
                    name: 'Modération',
                    value: '`-tempmute` | `/tempmute` - Mute temporaire\n`-mute` | `/mute` - Mute permanent\n`-unmute` | `/unmute` - Démuter\n`-kick` | `/kick` - Expulse\n`-ban` | `/ban` - Bannit\n`-warn` | `/warn` - Avertit\n`-soumis` | `/soumis` - Soumet un utilisateur\n`-unsoumis` | `/unsoumis` - Libère un utilisateur',
                    inline: false
                },
                {
                    name: 'Gestion des Sanctions',
                    value: '`-sanctions` | `/sanctions` - Voir toutes les sanctions d\'un utilisateur',
                    inline: false
                },
                {
                    name: 'Nettoyage',
                    value: '`-clear` | `/clear` - Supprime des messages (1-100)',
                    inline: false
                },
                {
                    name: 'Configuration',
                    value: '`-setup` | `/setup` - Configure le serveur depuis le template JSON',
                    inline: false
                },
                {
                    name: 'Informations',
                    value: 'Les commandes slash (`/`) sont recommandées pour une meilleure expérience!\nLors d\'une sanction, vous devrez choisir une catégorie et une gravité spécifique.\n\nUtilisez `-sanctions @user` pour voir l\'historique complet.',
                    inline: false
                }
            ],
            footer: {
                text: 'Bot Discord - Système de Modération par Catégorie'
            },
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
        if (!checkPermission(message.member, 'help')) {
            return message.reply('non ta pas la perm');
        }
        const embed = {
            color: 0x5865F2,
            title: 'Liste des Commandes',
            description: 'Voici toutes les commandes disponibles avec le préfixe `-` ou en slash:',
            fields: [
                {
                    name: 'Utilitaires',
                    value: '`-snipe` | `/snipe` - Message supprimé\n`-pic` | `/pic` - Photo de profil\n`-banner` | `/banner` - Bannière utilisateur\n`-fake` | `/fake` - Détecter les fakes (Screen Google)\n`-userinfo` | `/userinfo` - Infos utilisateur\n`-serverinfo` | `/serverinfo` - Infos serveur\n`-roleinfo` | `/roleinfo` - Infos rôle\n`-ping` | `/ping` - Latence\n`-stats` | `/stats` - Statistiques serveur',
                    inline: false
                },
                {
                    name: 'Modération',
                    value: '`-tempmute` | `/tempmute` - Mute temporaire\n`-mute` | `/mute` - Mute permanent\n`-unmute` | `/unmute` - Démuter\n`-kick` | `/kick` - Expulse\n`-ban` | `/ban` - Bannit\n`-warn` | `/warn` - Avertit\n`-soumis` | `/soumis` - Soumet un utilisateur\n`-unsoumis` | `/unsoumis` - Libère un utilisateur',
                    inline: false
                },
                {
                    name: 'Gestion des Sanctions',
                    value: '`-sanctions` | `/sanctions` - Voir toutes les sanctions d\'un utilisateur',
                    inline: false
                },
                {
                    name: 'Nettoyage',
                    value: '`-clear` | `/clear` - Supprime des messages (1-100)',
                    inline: false
                },
                {
                    name: 'Configuration',
                    value: '`-setup` | `/setup` - Configure le serveur depuis le template JSON',
                    inline: false
                },
                {
                    name: 'Informations',
                    value: 'Les commandes slash (`/`) sont recommandées pour une meilleure expérience!\nLors d\'une sanction, vous devrez choisir une catégorie et une gravité spécifique.\n\nUtilisez `-sanctions @user` pour voir l\'historique complet.',
                    inline: false
                }
            ],
            footer: {
                text: 'Bot Discord - Système de Modération par Catégorie'
            },
            timestamp: new Date().toISOString()
        };

        message.channel.send({ embeds: [embed] });
    }
};