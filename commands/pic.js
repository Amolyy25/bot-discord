const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pic')
        .setDescription('Affiche la photo de profil d\'un utilisateur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur dont vous voulez voir la photo')
                .setRequired(false)),

    async execute(interaction) {
        const { isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId) && !isAdmin(interaction.member)) return;
        if (!isBoosterOrPerm2(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }

        const user = interaction.options.getUser('utilisateur') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);

        const embed = {
            color: 0x5865F2,
            title: `Photo de profil de ${user.tag}`,
            image: { url: user.displayAvatarURL({ size: 4096, dynamic: true }) },
            fields: [
                {
                    name: 'ID',
                    value: user.id,
                    inline: true
                },
                {
                    name: 'Créé le',
                    value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
                    inline: true
                }
            ],
            footer: {
                text: interaction.user.tag,
                icon_url: interaction.user.displayAvatarURL()
            }
        };

        if (member && member.joinedAt) {
            embed.fields.push({
                name: 'Rejoint le',
                value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`,
                inline: true
            });
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message, args) {
        const { isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        if (isModChannel(message.channel.id) && !isAdmin(message.member)) return;
        if (!isBoosterOrPerm2(message.member)) {
            return message.reply('non ta pas la perm');
        }

        let user = message.mentions.users.first();
        
        if (!user && args[0]) {
            user = await message.client.users.fetch(args[0]).catch(() => null);
        }
        
        if (!user) user = message.author;

        const member = await message.guild.members.fetch(user.id).catch(() => null);

        const embed = {
            color: 0x5865F2,
            title: `Photo de profil de ${user.tag}`,
            image: { url: user.displayAvatarURL({ size: 4096, dynamic: true }) },
            fields: [
                {
                    name: 'ID',
                    value: user.id,
                    inline: true
                },
                {
                    name: 'Créé le',
                    value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
                    inline: true
                }
            ],
            footer: {
                text: message.author.tag,
                icon_url: message.author.displayAvatarURL()
            }
        };

        if (member && member.joinedAt) {
            embed.fields.push({
                name: 'Rejoint le',
                value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`,
                inline: true
            });
        }

        message.channel.send({ embeds: [embed] });
    }
};