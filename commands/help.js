const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste des commandes du bot'),

    async execute(interaction) {
        const embed = {
            color: 0x5865F2,
            title: 'Liste des Commandes',
            description: 'Voici toutes les commandes disponibles avec le préfixe `-` ou en slash:',
            fields: [
                {
                    name: 'Utilitaires',
                    value: '`-snipe` | `/snipe` - Message supprimé\n`-pic` | `/pic` - Photo de profil\n`-fake` | `/fake` - Détecter les fakes (Screen Google)\n`-userinfo` | `/userinfo` - Infos utilisateur\n`-serverinfo` | `/serverinfo` - Infos serveur\n`-roleinfo` | `/roleinfo` - Infos rôle\n`-ping` | `/ping` - Latence',
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
        const embed = {
            color: 0x5865F2,
            title: 'Liste des Commandes',
            description: 'Voici toutes les commandes disponibles avec le préfixe `-` ou en slash:',
            fields: [
                {
                    name: 'Utilitaires',
                    value: '`-snipe` | `/snipe` - Message supprimé\n`-pic` | `/pic` - Photo de profil\n`-fake` | `/fake` - Détecter les fakes (Screen Google)\n`-userinfo` | `/userinfo` - Infos utilisateur\n`-serverinfo` | `/serverinfo` - Infos serveur\n`-roleinfo` | `/roleinfo` - Infos rôle\n`-ping` | `/ping` - Latence',
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