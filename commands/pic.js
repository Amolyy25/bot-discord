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
        const { checkPermission, isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        const currentMember = interaction.member;
        const allowedRole = '1470487259315835052';
        const adminStatus = isAdmin(currentMember);
        
        // Vérification combinée : 'pic' OU isBoosterOrPerm2 OU rôle spécifique
        const hasPerm = checkPermission(currentMember, 'pic', (m) => isBoosterOrPerm2(m) || m.roles.cache.has(allowedRole));

        if (!hasPerm) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        
        if (isModChannel(interaction.channelId) && !adminStatus) return;

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
        const { checkPermission, isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        const allowedRole = '1470487259315835052';
        const adminStatus = isAdmin(message.member);
        
        // Vérification combinée : 'pic' OU isBoosterOrPerm2 OU rôle spécifique
        const hasPerm = checkPermission(message.member, 'pic', (m) => isBoosterOrPerm2(m) || m.roles.cache.has(allowedRole));

        if (!hasPerm) {
            return message.reply('non ta pas la perm');
        }
        
        if (isModChannel(message.channel.id) && !adminStatus) return;

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