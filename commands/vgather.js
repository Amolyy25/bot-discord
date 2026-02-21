const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { checkPermission, isAdmin } = require('./utils/permHelper');

const delay = ms => new Promise(res => setTimeout(res, ms));

function buildProgressEmbed(current, total, isFinished = false) {
    const percentage = total === 0 ? 100 : Math.floor((current / total) * 100);
    const filledSize = Math.floor(percentage / 10);
    const emptySize = 10 - filledSize;
    const bar = '🟩'.repeat(filledSize) + '⬛'.repeat(emptySize);
    
    return {
        color: isFinished ? 0x00FF00 : 0x5865F2,
        title: isFinished ? '✅ Rassemblement terminé' : '🔄 Rassemblement en cours...',
        description: `${bar} **${percentage}%**\n\nDéplacement : **${current} / ${total}** membres`,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vgather')
        .setDescription('Téléporte tous les membres vocaux du serveur dans ton salon actuel')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

    async execute(interaction) {
        if (!checkPermission(interaction.member, 'vgather') && !isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', ephemeral: true });
        }

        const targetChannel = interaction.member.voice.channel;
        if (!targetChannel) {
            return interaction.reply({ content: '❌ Vous devez être dans un salon vocal pour utiliser cette commande.', ephemeral: true });
        }

        await interaction.guild.members.fetch();
        const membersToMove = interaction.guild.members.cache.filter(m => m.voice.channelId && m.voice.channelId !== targetChannel.id);
        
        if (membersToMove.size === 0) {
            return interaction.reply({ content: '⚠️ Personne n\'est à rassembler (tous les vocaux sont vides ou tout le monde est déjà ici).', ephemeral: true });
        }

        const membersArray = Array.from(membersToMove.values());
        await interaction.reply({ embeds: [buildProgressEmbed(0, membersArray.length)] });

        let movedCount = 0;
        let lastEditTime = Date.now();

        for (const member of membersArray) {
            try {
                if (member.voice.channelId && member.voice.channelId !== targetChannel.id) {
                    await member.voice.setChannel(targetChannel);
                }
                movedCount++;
            } catch (error) {
                console.error(`Erreur de mouvement pour ${member.user.tag}:`, error);
                movedCount++;
            }

            const now = Date.now();
            if (movedCount % 5 === 0 || now - lastEditTime > 2000) {
                lastEditTime = now;
                await interaction.editReply({ embeds: [buildProgressEmbed(movedCount, membersArray.length)] }).catch(() => {});
                await delay(300);
            }
        }

        await interaction.editReply({ embeds: [buildProgressEmbed(membersArray.length, membersArray.length, true)] }).catch(() => {});
        
        const { logModAction } = require('./utils/logHelper');
        await logModAction(interaction.guild, {
            action: 'VGATHER',
            moderator: interaction.user,
            details: `A rassemblé ${membersArray.length} membre(s) vers ${targetChannel.name}.`,
            color: 0x5865F2
        }).catch(() => {});
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'vgather') && !isAdmin(message.member)) {
            return message.reply('❌ Vous n\'avez pas la permission.');
        }

        const targetChannel = message.member.voice.channel;
        if (!targetChannel) {
            return message.reply('❌ Vous devez être dans un salon vocal pour utiliser cette commande.');
        }

        await message.guild.members.fetch();
        const membersToMove = message.guild.members.cache.filter(m => m.voice.channelId && m.voice.channelId !== targetChannel.id);
        
        if (membersToMove.size === 0) {
            return message.reply('⚠️ Personne n\'est à rassembler (tous les vocaux sont vides ou tout le monde est déjà ici).');
        }

        const membersArray = Array.from(membersToMove.values());
        const replyMsg = await message.channel.send({ embeds: [buildProgressEmbed(0, membersArray.length)] });

        let movedCount = 0;
        let lastEditTime = Date.now();

        for (const member of membersArray) {
            try {
                if (member.voice.channelId && member.voice.channelId !== targetChannel.id) {
                    await member.voice.setChannel(targetChannel);
                }
                movedCount++;
            } catch (error) {
                console.error(`Erreur de mouvement pour ${member.user.tag}:`, error);
                movedCount++;
            }

            const now = Date.now();
            if (movedCount % 5 === 0 || now - lastEditTime > 2000) {
                lastEditTime = now;
                await replyMsg.edit({ embeds: [buildProgressEmbed(movedCount, membersArray.length)] }).catch(() => {});
                await delay(300);
            }
        }

        await replyMsg.edit({ embeds: [buildProgressEmbed(membersArray.length, membersArray.length, true)] }).catch(() => {});
        
        const { logModAction } = require('./utils/logHelper');
        await logModAction(message.guild, {
            action: 'VGATHER',
            moderator: message.author,
            details: `A rassemblé ${membersArray.length} membre(s) vers ${targetChannel.name}.`,
            color: 0x5865F2
        }).catch(() => {});
    }
};
