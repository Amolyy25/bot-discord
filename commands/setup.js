const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Crée 15 salons vocaux dans la catégorie actuelle')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(interaction.member);
        
        // On autorise si c'est un admin ou s'il a la perm ET que ce n'est pas le salon de modé (sauf bypass admin)
        if (isModChannel(interaction.channelId) && !adminStatus) return;
        if (!checkPermission(interaction.member, 'setup')) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }

        const categoryId = '1469071692348264635';
        
        await interaction.deferReply();

        try {
            for (let i = 1; i <= 15; i++) {
                await interaction.guild.channels.create({
                    name: `│ 🌼・Vocal ${i}`,
                    type: ChannelType.GuildVoice,
                    parent: categoryId,
                    reason: 'Setup vocaux'
                });
            }

            await interaction.editReply('✅ Les 15 salons vocaux ont été créés avec succès !');
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Une erreur est survenue lors de la création des salons.');
        }
    },

    async executeMessage(message, args) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(message.member);
        
        if (isModChannel(message.channel.id) && !adminStatus) return;
        if (!checkPermission(message.member, 'setup')) {
            return message.reply('non ta pas la perm');
        }

        const categoryId = '1469071692348264635';

        const msg = await message.reply('⏳ Création des 15 salons vocaux...');

        try {
            for (let i = 1; i <= 15; i++) {
                await message.guild.channels.create({
                    name: `│ 🌼・Vocal ${i}`,
                    type: ChannelType.GuildVoice,
                    parent: categoryId,
                    reason: 'Setup vocaux'
                });
            }

            await msg.edit('✅ Les 15 salons vocaux ont été créés avec succès !');
        } catch (error) {
            console.error(error);
            await msg.edit('❌ Une erreur est survenue lors de la création des salons.');
        }
    }
};
