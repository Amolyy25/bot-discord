const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setuprole')
        .setDescription('Envoie le système de choix de rôles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (!checkPermission(interaction.member, 'setuprole')) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', flags: 64 });
        }

        await this.sendSetup(interaction.guild, interaction.channel);
        await interaction.reply({ content: '✅ Système de rôles envoyé !', flags: 64 });
    },

    async executeMessage(message, args) {
        const { checkPermission, isAdmin } = require('./utils/permHelper');
        if (!checkPermission(message.member, 'setuprole')) {
            return message.reply('❌ Vous n\'avez pas la permission.');
        }

        await this.sendSetup(message.guild, message.channel);
        await message.delete().catch(() => {});
    },

    async sendSetup(guild, originChannel) {
        const targetChannelId = '1469071691526443218';
        const targetChannel = await guild.channels.fetch(targetChannelId).catch(() => null);
        
        if (!targetChannel) {
            throw new Error('Salon cible introuvable.');
        }

        // Embed Pings
        const embedPings = new EmbedBuilder()
            .setTitle('<:EMOJI1:1475911064289022103> Notifications')
            .setDescription('*→ Choisissez si vous souhaitez être mentionné ou non*')
            .setColor(0xFFFFFF);

        const rowPings = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('role_1469071689756442798')
                .setLabel('Ping')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('role_1469071689756442797')
                .setLabel('Pas de ping')
                .setStyle(ButtonStyle.Secondary)
        );

        // Embed Jeux
        const embedGames = new EmbedBuilder()
            .setTitle('<a:EMOJI2:1475911100422684792> Jeux')
            .setDescription('*→ Sélectionnez les jeux auxquels vous jouez*')
            .setColor(0xFFFFFF);

        const games = [
            { label: 'R6', id: '1469071689747791993' },
            { label: 'Fortnite', id: '1469071689747791992' },
            { label: 'LOL', id: '1469071689747791991' },
            { label: 'Minecraft', id: '1469071689747791990' },
            { label: 'Paladin', id: '1469071689747791989' },
            { label: 'Genshin impact', id: '1469071689747791987' },
            { label: 'GTA', id: '1469071689747791986' },
            { label: 'Apex', id: '1469071689735213235' },
            { label: 'Valo', id: '1469071689735213234' },
            { label: 'Call of duty', id: '1469071689735213236' }
        ];

        const rows = [];
        for (let i = 0; i < games.length; i += 5) {
            const row = new ActionRowBuilder();
            games.slice(i, i + 5).forEach(game => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`role_${game.id}`)
                        .setLabel(game.label)
                        .setStyle(ButtonStyle.Secondary)
                );
            });
            rows.push(row);
        }

        // Embed Autres
        const embedAutres = new EmbedBuilder()
            .setTitle('<a:owner:1473355068127445033> Rôles Divers')
            .setDescription('*→ Sélectionnez les rôles additionnels que vous souhaitez avoir*')
            .setColor(0xFFFFFF);

        const rowAutres = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('role_1475912347418759219')
                .setLabel('Event')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('role_1471790345082896437')
                .setLabel('Jeux')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('role_1472918018970484872')
                .setLabel('Communautaire')
                .setStyle(ButtonStyle.Secondary)
        );

        await targetChannel.send({ embeds: [embedPings], components: [rowPings] });
        await targetChannel.send({ embeds: [embedGames], components: rows });
        await targetChannel.send({ embeds: [embedAutres], components: [rowAutres] });
    }
};
