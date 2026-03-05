const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const trust = require('./utils/trustHelper');
const { checkPermission, ROLES } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('score')
        .setDescription('Affiche le score de confiance Lana Sentinel (Perm III+)')
        .addUserOption(option => option.setName('cible').setDescription('Le membre à vérifier')),
    
    async execute(interaction) {
        const hasPerm = await checkPermission(interaction.member, 'score');
        if (!hasPerm) return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', flags: 64 });

        const targetMember = interaction.options.getMember('cible') || interaction.member;
        const data = await trust.getTrustData(targetMember.id);

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Lana Sentinel - Profil de Confiance`)
            .setAuthor({ name: targetMember.user.tag, iconURL: targetMember.user.displayAvatarURL() })
            .setColor(data.trust_score < 20 ? 0xFF0000 : (data.trust_score < 50 ? 0xFFAA00 : (data.trust_score < 80 ? 0xFFFF00 : 0x00FF00)))
            .addFields(
                { name: 'Score de Confiance', value: `**${data.trust_score}/100**`, inline: true },
                { name: 'Messages Totaux', value: `${data.total_messages}`, inline: true },
                { name: 'Statut Shadow Mute', value: data.is_shadow_muted ? '🔴 ACTIF' : '🟢 INACTIF', inline: true },
                { name: 'Ancienneté', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`, inline: true }
            )
            .setThumbnail(targetMember.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: 'Système de Surveillance Stratifiée' });

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message, args) {
        const hasPerm = await checkPermission(message.member, 'score');
        if (!hasPerm) return;

        const target = message.mentions.members.first() || message.member;
        const data = await trust.getTrustData(target.id);

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Lana Sentinel - Profil de Confiance`)
            .setAuthor({ name: target.user.tag, iconURL: target.user.displayAvatarURL() })
            .setColor(data.trust_score < 20 ? 0xFF0000 : (data.trust_score < 50 ? 0xFFAA00 : (data.trust_score < 80 ? 0xFFFF00 : 0x00FF00)))
            .addFields(
                { name: 'Score de Confiance', value: `**${data.trust_score}/100**`, inline: true },
                { name: 'Messages Totaux', value: `${data.total_messages}`, inline: true },
                { name: 'Statut Shadow Mute', value: data.is_shadow_muted ? '🔴 ACTIF' : '🟢 INACTIF', inline: true }
            )
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    }
};
