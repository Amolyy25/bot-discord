const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Affiche la latence du bot'),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        if (!checkPermission(interaction.member, 'ping')) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        const sent = await interaction.reply({ content: '🏓 Pong!', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        const embed = {
            color: 0x00FF00,
            title: '🏓 Pong!',
            fields: [
                { name: 'Latence', value: `${latency}ms`, inline: true },
                { name: 'Latence API', value: `${apiLatency}ms`, inline: true }
            ],
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ content: '', embeds: [embed] });
    },

    async executeMessage(message) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
        if (!checkPermission(message.member, 'ping')) {
            return message.reply('non ta pas la perm');
        }
        const sent = await message.channel.send('🏓 Pong!');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(message.client.ws.ping);

        const embed = {
            color: 0x00FF00,
            title: '🏓 Pong!',
            fields: [
                { name: 'Latence', value: `${latency}ms`, inline: true },
                { name: 'Latence API', value: `${apiLatency}ms`, inline: true }
            ],
            timestamp: new Date().toISOString()
        };

        await sent.edit({ content: '', embeds: [embed] });
    }
};