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
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: 'Vous n\'avez pas la permission de supprimer des messages!', ephemeral: true });
        }

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
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Erreur lors de la suppression des messages!', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('Vous n\'avez pas la permission de supprimer des messages!');
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
        } catch (error) {
            console.error(error);
            message.reply('Erreur lors de la suppression des messages!');
        }
    }
};