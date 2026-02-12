const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clown')
        .setDescription('Certifie officiellement un utilisateur comme étant un clown')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Le clown à certifier')
                .setRequired(true)),

    async execute(interaction) {
        const { checkPermission, isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        // Bypass admin, sinon pas dans le salon modé
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        
        // Vérification combinée : 'clown' OU isBoosterOrPerm2 OU rôle spécifique
        const hasPerm = checkPermission(interaction.member, 'clown', (m) => isBoosterOrPerm2(m) || m.roles.cache.has('1469071689399926791'));

        if (!hasPerm) {
            return interaction.reply({ content: 'non ta pas la perm (Booster minimum)', ephemeral: true });
        }

        const target = interaction.options.getUser('utilisateur');
        await this.sendClownCertificate(interaction, target);
    },

    async executeMessage(message, args) {
        const { checkPermission, isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;

        // Vérification combinée : 'clown' OU isBoosterOrPerm2 OU rôle spécifique
        const hasPerm = checkPermission(message.member, 'clown', (m) => isBoosterOrPerm2(m) || m.roles.cache.has('1469071689399926791'));

        if (!hasPerm) {
            return message.reply('non ta pas la perm (Booster minimum)');
        }

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -clown @utilisateur ou ID');

        await this.sendClownCertificate(message, target);
    },

    async sendClownCertificate(context, target) {
        const isInteraction = !!context.isCommand;

        const embed = new EmbedBuilder()
            .setColor('#FF4500')
            .setTitle('🤡 CERTIFICAT D\'APTITUDE CLOWNESQUE 🤡')
            .setDescription(`Après analyse de ses récents messages, le haut conseil du cirque a décidé de certifier **${target.username}** en tant que clown professionnel.`)
            .addFields(
                { name: 'Niveau de drôlerie', value: '0/10 (Inexistant)', inline: true },
                { name: 'Statut', value: '🤡 Homologué', inline: true }
            )
            .setThumbnail(target.displayAvatarURL())
            .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnhicHhyZzRycXp4N3R6eHh4eHh4eHh4eHh4eHh4eHh4eHh4JnB0PWEmY3RuPXMmY3RsPWUmaD00MDAmZz13/3o7TKVUn7iM8FMEU24/giphy.gif')
            .setFooter({ text: 'Certifié par le Bureau International des Rigolos' })
            .setTimestamp();

        if (isInteraction) {
            await context.reply({ embeds: [embed] });
        } else {
            await context.channel.send({ embeds: [embed] });
        }
    }
};
