const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Affiche la bannière d\'un utilisateur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur dont vous voulez voir la bannière')
                .setRequired(false)),

    async execute(interaction) {
        const { checkPermission, isBoosterOrPerm2, isModChannel, isAdmin } = require('./utils/permHelper');
        const currentMember = interaction.member;
        const allowedRole = '1470487259315835052';
        const adminStatus = isAdmin(currentMember);
        
        // Vérification combinée : 'banner' OU isBoosterOrPerm2 OU rôle spécifique
        const hasPerm = checkPermission(currentMember, 'banner', (m) => isBoosterOrPerm2(m) || m.roles.cache.has(allowedRole));

        if (!hasPerm) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        
        if (isModChannel(interaction.channelId) && !adminStatus) return;

        let user = interaction.options.getUser('utilisateur') || interaction.user;
        
        // Fetch user to ensure banner is available
        user = await interaction.client.users.fetch(user.id, { force: true });

        const bannerUrl = user.bannerURL({ size: 4096, dynamic: true });

        if (!bannerUrl) {
            return interaction.reply({ content: "Cet utilisateur n'a pas de bannière.", ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        const embed = {
            color: 0x5865F2,
            title: `Bannière de ${user.tag}`,
            image: { url: bannerUrl },
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
        
        // Vérification combinée : 'banner' OU isBoosterOrPerm2 OU rôle spécifique
        const hasPerm = checkPermission(message.member, 'banner', (m) => isBoosterOrPerm2(m) || m.roles.cache.has(allowedRole));

        if (!hasPerm) {
            return message.reply('non ta pas la perm');
        }
        
        if (isModChannel(message.channel.id) && !adminStatus) return;

        let userCheck = message.mentions.users.first();
        
        if (!userCheck && args[0]) {
            userCheck = await message.client.users.fetch(args[0]).catch(() => null);
        }
        
        if (!userCheck) userCheck = message.author;

        // Fetch user to ensure banner is available
        const user = await message.client.users.fetch(userCheck.id, { force: true });
        const bannerUrl = user.bannerURL({ size: 4096, dynamic: true });

        if (!bannerUrl) {
            return message.reply("Cet utilisateur n'a pas de bannière.");
        }

        const member = await message.guild.members.fetch(user.id).catch(() => null);

        const embed = {
            color: 0x5865F2,
            title: `Bannière de ${user.tag}`,
            image: { url: bannerUrl },
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
