const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const jackpot = require('./utils/jackpotHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testjackpot')
        .setDescription('Force le lancement d\'un événement Jackpot Chrono (Admin seulement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        await interaction.reply({ content: 'Lancement du Jackpot Chrono dans le salon de test...', ephemeral: true });
        // Utilisation du salon spécifique demandé par l'utilisateur pour le test
        const testChannelId = '1469071690695704887';
        await jackpot.launchJackpot(client, testChannelId);
    },

    async executeMessage(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Tu n\'as pas la permission d\'utiliser cette commande.');
        }
        message.reply('Lancement du Jackpot Chrono dans le salon de test...');
        const testChannelId = '1469071690695704887';
        await jackpot.launchJackpot(client, testChannelId);
    }
};