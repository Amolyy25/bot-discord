const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { checkPermission, isAdmin } = require('./utils/permHelper');

const delay = ms => new Promise(res => setTimeout(res, ms));

function buildProgressEmbed(current, total, isFinished = false) {
    const percentage = total === 0 ? 100 : Math.floor((current / total) * 100);
    const filledSize = Math.floor(percentage / 10);
    const emptySize = 10 - filledSize;
    const bar = '🟩'.repeat(filledSize) + '⬛'.repeat(emptySize);
    
    return {
        color: isFinished ? 0xFF0000 : 0xFFA500,
        title: isFinished ? '✅ Nettoyage vocal terminé' : '🔄 Déconnexion en cours...',
        description: `${bar} **${percentage}%**\n\nDéconnexion : **${current} / ${total}** membres`,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vclear')
        .setDescription('Déconnecte tous les membres d\'un salon vocal')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .addChannelOption(opt => opt.setName('salon').setDescription('Salon vocal à vider').addChannelTypes(ChannelType.GuildVoice).setRequired(true)),

    async execute(interaction) {
        if (!checkPermission(interaction.member, 'vclear') && !isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', flags: 64 });
        }

        const targetChannel = interaction.options.getChannel('salon');
        const membersToDisconnect = Array.from(targetChannel.members.values());
        
        if (membersToDisconnect.length === 0) {
            return interaction.reply({ content: '⚠️ Personne n\'est connecté dans ce salon vocal.', flags: 64 });
        }

        await interaction.reply({ embeds: [buildProgressEmbed(0, membersToDisconnect.length)] });

        let movedCount = 0;
        let lastEditTime = Date.now();

        for (const member of membersToDisconnect) {
            try {
                if (member.voice.channelId === targetChannel.id) {
                    await member.voice.disconnect();
                }
                movedCount++;
            } catch (error) {
                console.error(`Erreur de vclear pour ${member.user.tag}:`, error);
                movedCount++;
            }

            const now = Date.now();
            if (movedCount % 5 === 0 || now - lastEditTime > 2000) {
                lastEditTime = now;
                await interaction.editReply({ embeds: [buildProgressEmbed(movedCount, membersToDisconnect.length)] }).catch(() => {});
                await delay(300);
            }
        }

        await interaction.editReply({ embeds: [buildProgressEmbed(membersToDisconnect.length, membersToDisconnect.length, true)] }).catch(() => {});
        
        const { logModAction } = require('./utils/logHelper');
        await logModAction(interaction.guild, {
            action: 'VCLEAR',
            moderator: interaction.user,
            details: `A vidé le salon vocal ${targetChannel.name} (${membersToDisconnect.length} expulsés).`,
            color: 0xFF0000
        }).catch(() => {});
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'vclear') && !isAdmin(message.member)) {
            return message.reply('❌ Vous n\'avez pas la permission.');
        }

        let targetChannel = message.member.voice.channel;
        
        if (args[0]) {
            const channelIdMatch = args[0].match(/^<#!?(\d+)>$/);
            const channelId = channelIdMatch ? channelIdMatch[1] : args[0];
            try {
                const channel = message.guild.channels.cache.get(channelId);
                if (channel && channel.type === ChannelType.GuildVoice) {
                    targetChannel = channel;
                }
            } catch (e) {}
        }

        if (!targetChannel) {
            return message.reply('❌ Vous devez mentionner (ou donner l\'ID) d\'un salon vocal, ou être connecté dans un salon.');
        }

        const membersToDisconnect = Array.from(targetChannel.members.values());
        
        if (membersToDisconnect.length === 0) {
            return message.reply('⚠️ Personne n\'est connecté dans ce salon vocal.');
        }

        const replyMsg = await message.channel.send({ embeds: [buildProgressEmbed(0, membersToDisconnect.length)] });

        let movedCount = 0;
        let lastEditTime = Date.now();

        for (const member of membersToDisconnect) {
            try {
                if (member.voice.channelId === targetChannel.id) {
                    await member.voice.disconnect();
                }
                movedCount++;
            } catch (error) {
                console.error(`Erreur de vclear pour ${member.user.tag}:`, error);
                movedCount++;
            }

            const now = Date.now();
            if (movedCount % 5 === 0 || now - lastEditTime > 2000) {
                lastEditTime = now;
                await replyMsg.edit({ embeds: [buildProgressEmbed(movedCount, membersToDisconnect.length)] }).catch(() => {});
                await delay(300);
            }
        }

        await replyMsg.edit({ embeds: [buildProgressEmbed(membersToDisconnect.length, membersToDisconnect.length, true)] }).catch(() => {});
        
        const { logModAction } = require('./utils/logHelper');
        await logModAction(message.guild, {
            action: 'VCLEAR',
            moderator: message.author,
            details: `A vidé le salon vocal ${targetChannel.name} (${membersToDisconnect.length} expulsés).`,
            color: 0xFF0000
        }).catch(() => {});
    }
};
