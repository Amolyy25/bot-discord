const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

if (!global.prisonniers) {
    global.prisonniers = new Map(); // userId -> channelId
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prison')
        .setDescription('Envoie quelqu\'un au cachot vocal')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Le prisonnier')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duree')
                .setDescription('Durée en minutes (max 30)')
                .setRequired(false)),

    async execute(interaction) {
        const { checkPermission, isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        
        // Vérification de permission : 'prison' ou isBoosterOrPerm2 par défaut
        if (!checkPermission(interaction.member, 'prison', isBoosterOrPerm2)) {
            return interaction.reply({ content: 'non ta pas la perm (Booster minimum)', ephemeral: true });
        }

        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;

        const targetUser = interaction.options.getUser('utilisateur');
        const duration = interaction.options.getInteger('duree') || 5;
        
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'Utilisateur non trouvé !', ephemeral: true });
        if (!member.voice.channel) return interaction.reply({ content: 'L\'utilisateur n\'est pas en vocal !', ephemeral: true });

        const prisonChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase().includes('prison') || c.name.toLowerCase().includes('cachot'));
        if (!prisonChannel) return interaction.reply({ content: 'Aucun salon nommé "Prison" n\'a été trouvé !', ephemeral: true });

        const expiration = Date.now() + (duration * 60 * 1000);
        global.prisonniers.set(member.id, {
            channelId: prisonChannel.id,
            expiration: expiration
        });

        try {
            await member.voice.setChannel(prisonChannel);
            await interaction.reply({ content: `⚖️ **${targetUser.tag}** a été condamné à ${duration} minutes de cachot !` });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Je n\'ai pas la permission de déplacer ce membre !', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        const { checkPermission, isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        
        // Vérification de permission : 'prison' ou isBoosterOrPerm2 par défaut
        if (!checkPermission(message.member, 'prison', isBoosterOrPerm2)) {
            return message.reply('non ta pas la perm (Booster minimum)');
        }

        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -prison @utilisateur [minutes]');

        let duration = parseInt(args[1]) || 5;
        if (isNaN(duration)) duration = 5;

        const member = await message.guild.members.fetch(target.id).catch(() => null);
        if (!member) return message.reply('Utilisateur non trouvé !');
        if (!member.voice.channel) return message.reply('L\'utilisateur n\'est pas en vocal !');

        const prisonChannel = message.guild.channels.cache.find(c => c.name.toLowerCase().includes('prison') || c.name.toLowerCase().includes('cachot'));
        if (!prisonChannel) return message.reply('Aucun salon nommé "Prison" n\'a été trouvé !');

        const expiration = Date.now() + (duration * 60 * 1000);
        global.prisonniers.set(member.id, {
            channelId: prisonChannel.id,
            expiration: expiration
        });

        try {
            await member.voice.setChannel(prisonChannel);
            await message.reply(`⚖️ **${target.tag}** a été condamné à ${duration} minutes de cachot !`);
        } catch (error) {
            console.error(error);
            message.reply('Je n\'ai pas la permission de déplacer ce membre !');
        }
    }
};
