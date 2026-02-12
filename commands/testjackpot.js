const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const jackpot = require('./utils/jackpotHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testjackpot')
        .setDescription('Force le lancement d\'un événement Jackpot Chrono (Admin seulement)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => 
            option.setName('salon')
                .setDescription('Le salon où envoyer le jackpot (Optionnel, défaut: Général)')
                .addChannelTypes(ChannelType.GuildText)
        ),

    async execute(interaction, client) {
        // Récupérer le salon choisi ou null
        const targetChannel = interaction.options.getChannel('salon');
        const targetChannelId = targetChannel ? targetChannel.id : null;
        const channelName = targetChannel ? targetChannel.name : "Salon par défaut (Général)";

        await interaction.reply({ content: `✅ Lancement forcé du Jackpot Chrono dans **${channelName}**...`, ephemeral: true });
        
        // Lancer le jackpot avec l'ID du salon (ou null pour défaut)
        await jackpot.launchJackpot(client, targetChannelId);
    },

    async executeMessage(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Tu n\'as pas la permission d\'utiliser cette commande.');
        }

        // Gestion basique d'argument pour le salon (mentions)
        const targetChannel = message.mentions.channels.first();
        const targetChannelId = targetChannel ? targetChannel.id : null;
        const channelName = targetChannel ? targetChannel.name : "Salon par défaut (Général)";

        message.reply(`✅ Lancement forcé du Jackpot Chrono dans **${channelName}**...`);
        await jackpot.launchJackpot(client, targetChannelId);
    }
};
