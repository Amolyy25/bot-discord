const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Affiche le dernier message supprimé')
        .addUserOption(option => 
            option.setName('utilisateur')
                .setDescription('L\'utilisateur spécifique à sniper')
                .setRequired(false)),

    async execute(interaction, client, snipes) {
        const { isPerm3OrAdmin, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        if (!isPerm3OrAdmin(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }

        const channelSnipes = snipes.get(interaction.channelId);
        if (!channelSnipes || channelSnipes.length === 0) {
            return interaction.reply({ content: 'Aucun message supprimé récent à sniper!', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('utilisateur');
        let snipe;

        if (targetUser) {
            snipe = channelSnipes.find(s => s.author.id === targetUser.id);
        } else {
            snipe = channelSnipes[0];
        }

        if (!snipe) {
            const errorMsg = targetUser 
                ? `Aucun message supprimé récent trouvé pour **${targetUser.tag}**.` 
                : 'Aucun message supprimé récent à sniper!';
            return interaction.reply({ content: errorMsg, ephemeral: true });
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
        const { isPerm3OrAdmin, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
        if (!isPerm3OrAdmin(message.member)) {
            return message.reply('non ta pas la perm');
        }

        const channelSnipes = snipes.get(message.channel.id);
        if (!channelSnipes || channelSnipes.length === 0) {
            return message.reply('Aucun message supprimé récent à sniper!');
        }

        let targetUserId = null;

        // 1. Priorité à la réponse (reply)
        if (message.reference) {
            try {
                const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                targetUserId = referencedMessage.author.id;
            } catch (e) {
                console.error('Erreur fetch message reference:', e);
            }
        }

        // 2. Mentions ou ID dans les arguments
        if (!targetUserId && args.length > 0) {
            const mention = message.mentions.users.first();
            if (mention) {
                targetUserId = mention.id;
            } else if (/^\d+$/.test(args[0])) {
                targetUserId = args[0];
            }
        }

        let snipe;
        if (targetUserId) {
            snipe = channelSnipes.find(s => s.author.id === targetUserId);
        } else {
            snipe = channelSnipes[0];
        }

        if (!snipe) {
            return message.reply('Aucun message supprimé récent trouvé pour cet utilisateur!');
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