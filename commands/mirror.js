const { SlashCommandBuilder } = require('discord.js');

// On utilise un Map global pour stocker les utilisateurs à mirrorer.
// Clé: userId, Valeur: expirationTimestamp
if (!global.mirroredUsers) {
    global.mirroredUsers = new Map();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mirror')
        .setDescription('Active le mode miroir sur quelqu\'un (le bot l\'imite)')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('La cible à mirrorer')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duree')
                .setDescription('Durée en minutes (max 10)')
                .setRequired(false)),

    async execute(interaction) {
        const { isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;

        if (!isBoosterOrPerm2(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm (Booster minimum)', ephemeral: true });
        }

        const target = interaction.options.getUser('utilisateur');
        let duration = interaction.options.getInteger('duree') || 2;
        if (duration > 10) duration = 10;

        const expiration = Date.now() + (duration * 60 * 1000);
        global.mirroredUsers.set(target.id, expiration);

        await interaction.reply({ content: `🎭 Le mode miroir est activé sur **${target.tag}** pendant ${duration} minutes !` });
    },

    async executeMessage(message, args) {
        const { isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;

        if (!isBoosterOrPerm2(message.member)) {
            return message.reply('non ta pas la perm (Booster minimum)');
        }

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -mirror @utilisateur [minutes]');

        let duration = parseInt(args[1]) || 2;
        if (isNaN(duration) || duration < 1) duration = 2;
        if (duration > 10) duration = 10;

        const expiration = Date.now() + (duration * 60 * 1000);
        global.mirroredUsers.set(target.id, expiration);

        await message.reply(`🎭 Le mode miroir est activé sur **${target.tag}** pendant ${duration} minutes !`);
    }
};
