const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Affiche le dernier message supprimé'),

    async execute(interaction, client, snipes) {
        const { isPerm3OrAdmin, isModChannel } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId)) return;
        if (!isPerm3OrAdmin(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        const snipe = snipes.get(interaction.channelId);

        if (!snipe) {
            return interaction.reply({ content: 'Aucun message supprimé récent à sniper!', ephemeral: true });
        }

        const timeDiff = Math.floor((Date.now() - snipe.timestamp) / 1000);
        const timeText = timeDiff < 60 ? `${timeDiff} secondes` : timeDiff < 3600 ? `${Math.floor(timeDiff / 60)} minutes` : `${Math.floor(timeDiff / 3600)} heures`;

        const embed = {
            color: 0x5865F2,
            title: 'Message Supprimé',
            description: snipe.content,
            author: {
                name: snipe.author.tag,
                icon_url: snipe.author.displayAvatarURL()
            },
            footer: {
                text: `Supprimé il y a ${timeText}`
            },
            timestamp: new Date(snipe.timestamp).toISOString()
        };

        if (snipe.image) {
            embed.image = { url: snipe.image };
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message, args, client, snipes) {
        const { isPerm3OrAdmin, isModChannel } = require('./utils/permHelper');
        if (isModChannel(message.channel.id)) return;
        if (!isPerm3OrAdmin(message.member)) {
            return message.reply('non ta pas la perm');
        }
        const snipe = snipes.get(message.channel.id);

        if (!snipe) {
            return message.reply('Aucun message supprimé récent à sniper!');
        }

        const timeDiff = Math.floor((Date.now() - snipe.timestamp) / 1000);
        const timeText = timeDiff < 60 ? `${timeDiff} secondes` : timeDiff < 3600 ? `${Math.floor(timeDiff / 60)} minutes` : `${Math.floor(timeDiff / 3600)} heures`;

        const embed = {
            color: 0x5865F2,
            title: 'Message Supprimé',
            description: snipe.content,
            author: {
                name: snipe.author.tag,
                icon_url: snipe.author.displayAvatarURL()
            },
            footer: {
                text: `Supprimé il y a ${timeText}`
            },
            timestamp: new Date(snipe.timestamp).toISOString()
        };

        if (snipe.image) {
            embed.image = { url: snipe.image };
        }

        message.channel.send({ embeds: [embed] });
    }
};