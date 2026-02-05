const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const sanctionsPath = path.join(__dirname, '../sanctions.json');

function loadSanctions() {
    if (fs.existsSync(sanctionsPath)) {
        return JSON.parse(fs.readFileSync(sanctionsPath, 'utf8'));
    }
    return {};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sanctions')
        .setDescription('Affiche toutes les sanctions d\'un utilisateur')
        .addStringOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'ID ou la mention de l\'utilisateur')
                .setRequired(false)),

    async execute(interaction) {
        const userStr = interaction.options.getString('utilisateur');
        let userId;

        if (userStr) {
            const mentionMatch = userStr.match(/^<@!?(\d+)>$/);
            userId = mentionMatch ? mentionMatch[1] : userStr;
        } else {
            userId = interaction.user.id;
        }

        const sanctions = loadSanctions();
        const guildId = interaction.guild.id;

        if (!sanctions[guildId] || !sanctions[guildId][userId] || sanctions[guildId][userId].length === 0) {
            return interaction.reply({ content: 'Aucune sanction trouvée pour cet utilisateur!', ephemeral: true });
        }

        const userSanctions = sanctions[guildId][userId];

        const gravityColors = {
            'Faible': 0x00FF00,
            'Moyenne': 0xFFA500,
            'Élevée': 0xFF0000
        };

        const sanctionList = userSanctions.map((sanction, index) => {
            let durationText = sanction.duration ? `\nDurée: ${sanction.duration}` : '';
            let expiryText = '';
            if (sanction.expiresAt) {
                const isExpired = new Date(sanction.expiresAt) < new Date();
                expiryText = `\n${isExpired ? '[Expiré]' : '[Actif]'} Expire: <t:${Math.floor(new Date(sanction.expiresAt).getTime() / 1000)}:F>`;
            }
            return `**${index + 1}. ${sanction.type.toUpperCase()}**\nCatégorie: ${sanction.category || 'N/A'}\nGravité: ${sanction.gravity || 'N/A'}${durationText}${expiryText}\nPar: ${sanction.moderator}\nRaison: ${sanction.reason}\nDate: <t:${Math.floor(new Date(sanction.timestamp).getTime() / 1000)}:F>`;
        }).join('\n\n─────────────\n\n');

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const userTag = member?.user?.tag || userId;

        const embed = {
            color: 0x5865F2,
            title: `Sanctions de ${userTag}`,
            description: sanctionList,
            fields: [
                { name: 'Total des sanctions', value: `${userSanctions.length}`, inline: true }
            ],
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message, args) {
        let userId;
        if (args[0]) {
            const mentionMatch = args[0].match(/^<@!?(\d+)>$/);
            userId = mentionMatch ? mentionMatch[1] : args[0];
        } else {
            userId = message.author.id;
        }

        const sanctions = loadSanctions();
        const guildId = message.guild.id;

        if (!sanctions[guildId] || !sanctions[guildId][userId] || sanctions[guildId][userId].length === 0) {
            return message.reply('Aucune sanction trouvée pour cet utilisateur!');
        }

        const userSanctions = sanctions[guildId][userId];

        const sanctionList = userSanctions.map((sanction, index) => {
            let durationText = sanction.duration ? `\nDurée: ${sanction.duration}` : '';
            let expiryText = '';
            if (sanction.expiresAt) {
                const isExpired = new Date(sanction.expiresAt) < new Date();
                expiryText = `\n${isExpired ? '[Expiré]' : '[Actif]'} Expire: <t:${Math.floor(new Date(sanction.expiresAt).getTime() / 1000)}:F>`;
            }
            return `**${index + 1}. ${sanction.type.toUpperCase()}**\nCatégorie: ${sanction.category || 'N/A'}\nGravité: ${sanction.gravity || 'N/A'}${durationText}${expiryText}\nPar: ${sanction.moderator}\nRaison: ${sanction.reason}\nDate: <t:${Math.floor(new Date(sanction.timestamp).getTime() / 1000)}:F>`;
        }).join('\n\n─────────────\n\n');

        const member = await message.guild.members.fetch(userId).catch(() => null);
        const userTag = member?.user?.tag || userId;

        const embed = {
            color: 0x5865F2,
            title: `Sanctions de ${userTag}`,
            description: sanctionList,
            fields: [
                { name: 'Total des sanctions', value: `${userSanctions.length}`, inline: true }
            ],
            timestamp: new Date().toISOString()
        };

        message.channel.send({ embeds: [embed] });
    }
};