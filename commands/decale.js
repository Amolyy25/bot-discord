const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('decale')
        .setDescription('Ferme définitivement le serveur (Supprime tous les salons)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const { isAdmin } = require('./utils/permHelper');

        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: 'Seul un administrateur peut utiliser cette commande.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            const guild = interaction.guild;
            
            // Création du salon de fermeture
            const newChannel = await guild.channels.create({
                name: 'serveur-fermé',
                type: 0, // GuildText
                reason: 'Fermeture du serveur (commande decal)'
            });

            // Récupère tous les salons
            const channels = await guild.channels.fetch();

            // Supprime tous les salons sauf le nouveau
            for (const [id, channel] of channels) {
                if (id !== newChannel.id) {
                    try {
                        await channel.delete('Fermeture du serveur (commande decal)');
                    } catch (e) {
                        console.error(`Impossible de supprimer le salon ${channel.name}:`, e);
                    }
                }
            }

            // Envoi de l'embed pour remercier la communauté
            const embed = new EmbedBuilder()
                .setTitle('Serveur Fermé')
                .setDescription("Le serveur a fermé ses portes.\nMerci à tous pour votre implication !")
                .setColor(0xFF0000)
                .setTimestamp();

            await newChannel.send({ embeds: [embed] });

            try {
                await interaction.editReply({ content: 'Le serveur a été fermé avec succès.' });
            } catch (e) {
                // Cette exception est attendue si le salon dans lequel la commande a été exécutée a été supprimé
            }

        } catch (error) {
            console.error('Erreur lors de la fermeture du serveur:', error);
            try {
                await interaction.editReply({ content: 'Une erreur est survenue lors de la fermeture du serveur.' });
            } catch (e) {}
        }
    },

    async executeMessage(message, args) {
        const { isAdmin } = require('./utils/permHelper');

        if (!isAdmin(message.member)) {
            return message.reply('Seul un administrateur peut utiliser cette commande.');
        }

        try {
            const guild = message.guild;
            
            const newChannel = await guild.channels.create({
                name: 'serveur-fermé',
                type: 0,
                reason: 'Fermeture du serveur (commande decal)'
            });

            const channels = await guild.channels.fetch();

            for (const [id, channel] of channels) {
                if (id !== newChannel.id) {
                    try {
                        await channel.delete('Fermeture du serveur (commande decal)');
                    } catch (e) {
                        console.error(`Impossible de supprimer le salon ${channel.name}:`, e);
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('Serveur Fermé')
                .setDescription("Le serveur a fermé ses portes.\nMerci à tous pour votre implication !")
                .setColor(0xFF0000)
                .setTimestamp();

            await newChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de la fermeture du serveur:', error);
            try {
                 await message.reply('Une erreur est survenue lors de la fermeture du serveur.');
            } catch (e) {}
        }
    }
};
