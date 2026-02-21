const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre de messages')
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de messages à supprimer (1-100)')
                .setRequired(true)),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(interaction.member);
        
        // Vérification de permission
        if (!checkPermission(interaction.member, 'clear')) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        
        if (!isModChannel(interaction.channelId) && !adminStatus) return;

        const amount = interaction.options.getInteger('nombre');

        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: 'Le nombre de messages doit être entre 1 et 100!', ephemeral: true });
        }

        try {
            await interaction.channel.bulkDelete(amount, true);

            const embed = {
                color: 0x00FF00,
                title: 'Messages Supprimés',
                fields: [
                    { name: 'Nombre', value: `${amount} message(s)`, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true },
                    { name: 'Salon', value: interaction.channel.name, inline: true }
                ],
                timestamp: new Date().toISOString()
            };

            const reply = await interaction.channel.send({ embeds: [embed] });
            setTimeout(() => reply.delete().catch(() => {}), 5000);

            const { logModAction } = require('./utils/logHelper');
            await logModAction(interaction.guild, {
                action: 'CLEAR',
                moderator: interaction.user,
                details: `Nombre: ${amount} messages\nSalon: ${interaction.channel.name}`,
                color: 0x00FF00
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Erreur lors de la suppression des messages!', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(message.member);
        
        // Vérification de permission
        if (!checkPermission(message.member, 'clear')) {
            return message.reply('non ta pas la perm');
        }

        const amount = parseInt(args[0]);

        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('Le nombre de messages doit être entre 1 et 100!');
        }

        try {
            await message.channel.bulkDelete(amount, true);

            const embed = {
                color: 0x00FF00,
                title: 'Messages Supprimés',
                fields: [
                    { name: 'Nombre', value: `${amount} message(s)`, inline: true },
                    { name: 'Modérateur', value: message.author.tag, inline: true },
                    { name: 'Salon', value: message.channel.name, inline: true }
                ],
                timestamp: new Date().toISOString()
            };

            const reply = await message.channel.send({ embeds: [embed] });
            setTimeout(() => reply.delete().catch(() => {}), 5000);

            const { logModAction } = require('./utils/logHelper');
            await logModAction(message.guild, {
                action: 'CLEAR',
                moderator: message.author,
                details: `Nombre: ${amount} messages\nSalon: ${message.channel.name}`,
                color: 0x00FF00
            });
        } catch (error) {
            console.error(error);
            message.reply('Erreur lors de la suppression des messages!');
        }
    }
};