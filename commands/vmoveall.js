const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { checkPermission, isAdmin } = require('./utils/permHelper');

const delay = ms => new Promise(res => setTimeout(res, ms));

function buildProgressEmbed(current, total, isFinished = false) {
    const percentage = total === 0 ? 100 : Math.floor((current / total) * 100);
    const filledSize = Math.floor(percentage / 10);
    const emptySize = 10 - filledSize;
    const bar = '🟩'.repeat(filledSize) + '⬛'.repeat(emptySize);
    
    return {
        color: isFinished ? 0x00FF00 : 0x5865F2,
        title: isFinished ? '✅ Déplacement terminé' : '🔄 Déplacement en cours...',
        description: `${bar} **${percentage}%**\n\nDéplacement : **${current} / ${total}** membres`,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vmoveall')
        .setDescription('Déplace tout ton salon vocal actuel vers un ou plusieurs autres salons')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .addChannelOption(opt => opt.setName('salon1').setDescription('Salon cible principal').addChannelTypes(ChannelType.GuildVoice).setRequired(true))
        .addChannelOption(opt => opt.setName('salon2').setDescription('Autre salon cible (répartition aléatoire)').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
        .addChannelOption(opt => opt.setName('salon3').setDescription('Autre salon cible').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
        .addChannelOption(opt => opt.setName('salon4').setDescription('Autre salon cible').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
        .addChannelOption(opt => opt.setName('salon5').setDescription('Autre salon cible').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
        .addChannelOption(opt => opt.setName('salon6').setDescription('Autre salon cible').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
        .addChannelOption(opt => opt.setName('salon7').setDescription('Autre salon cible').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
        .addChannelOption(opt => opt.setName('salon8').setDescription('Autre salon cible').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
        .addChannelOption(opt => opt.setName('salon9').setDescription('Autre salon cible').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
        .addChannelOption(opt => opt.setName('salon10').setDescription('Autre salon cible').addChannelTypes(ChannelType.GuildVoice).setRequired(false)),

    async execute(interaction) {
        if (!checkPermission(interaction.member, 'vmoveall') && !isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', flags: 64 });
        }

        const sourceChannel = interaction.member.voice.channel;
        if (!sourceChannel) {
            return interaction.reply({ content: '❌ Vous devez être dans un salon vocal pour utiliser cette commande.', flags: 64 });
        }

        const membersToMove = Array.from(sourceChannel.members.values());
        if (membersToMove.length === 0) {
            return interaction.reply({ content: '⚠️ Personne n\'est connecté dans votre salon vocal!', flags: 64 });
        }

        const targetChannels = [];
        for (let i = 1; i <= 10; i++) {
            const channel = interaction.options.getChannel(`salon${i}`);
            if (channel && channel.type === ChannelType.GuildVoice && channel.id !== sourceChannel.id) {
                targetChannels.push(channel);
            }
        }

        if (targetChannels.length === 0) {
            return interaction.reply({ content: '❌ Vous devez spécifier au moins un salon vocal cible valide (différent de votre salon actuel).', flags: 64 });
        }

        await interaction.reply({ embeds: [buildProgressEmbed(0, membersToMove.length)] });

        // Mélanger les membres pour une répartition aléatoire si on a plusieurs salons
        if (targetChannels.length > 1) {
            membersToMove.sort(() => Math.random() - 0.5);
        }

        let movedCount = 0;
        let lastEditTime = Date.now();

        for (const member of membersToMove) {
            // Sélectionner un salon cible (distribué uniformément)
            const targetChannel = targetChannels[movedCount % targetChannels.length];

            try {
                // On vérifie s'il est toujours dans le vocal
                if (member.voice.channelId === sourceChannel.id) {
                    await member.voice.setChannel(targetChannel);
                }
                movedCount++;
            } catch (error) {
                console.error(`Erreur de mouvement pour ${member.user.tag}:`, error);
                // Si l'utilisateur n'est plus en vocal, Discord API renvoie parfois une erreur, on ignore
                movedCount++;
            }

            // Met à jour l'embed toutes les 5 personnes pour éviter le rate limit Discord (~3 sec max)
            const now = Date.now();
            if (movedCount % 5 === 0 || now - lastEditTime > 2000) {
                lastEditTime = now;
                await interaction.editReply({ embeds: [buildProgressEmbed(movedCount, membersToMove.length)] }).catch(() => {});
                await delay(300); // Petit délai supplémentaire pour éviter les pics
            }
        }

        // Fin
        await interaction.editReply({ embeds: [buildProgressEmbed(membersToMove.length, membersToMove.length, true)] }).catch(() => {});
        
        const { logModAction } = require('./utils/logHelper');
        await logModAction(interaction.guild, {
            action: 'VMOVEALL',
            moderator: interaction.user,
            details: `A déplacé ${membersToMove.length} membre(s) depuis ${sourceChannel.name} vers ${targetChannels.length} salon(s).`,
            color: 0x5865F2
        }).catch(() => {});
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'vmoveall') && !isAdmin(message.member)) {
            return message.reply('❌ Vous n\'avez pas la permission.');
        }

        const sourceChannel = message.member.voice.channel;
        if (!sourceChannel) {
            return message.reply('❌ Vous devez être dans un salon vocal pour utiliser cette commande.');
        }

        const membersToMove = Array.from(sourceChannel.members.values());
        if (membersToMove.length === 0) {
            return message.reply('⚠️ Personne n\'est connecté dans votre salon vocal!');
        }

        // Analyser les arguments pour trouver des salons vocaux
        // Les cibles peuvent être des mentions de salon <#123> ou des IDs bruts
        const targetChannels = [];
        
        for (const arg of args) {
            const channelIdMatch = arg.match(/^<#!?(\d+)>$/);
            const channelId = channelIdMatch ? channelIdMatch[1] : arg;
            
            try {
                const channel = message.guild.channels.cache.get(channelId);
                if (channel && channel.type === ChannelType.GuildVoice && channel.id !== sourceChannel.id) {
                    if (!targetChannels.includes(channel)) {
                        targetChannels.push(channel);
                    }
                }
            } catch (e) {}
        }

        if (targetChannels.length === 0) {
            return message.reply('❌ Vous devez mentionner (ou donner l\'ID) au moins un salon vocal cible valide.\nEx: `-vmoveall <id_salon_1> <id_salon_2>`');
        }

        const replyMsg = await message.channel.send({ embeds: [buildProgressEmbed(0, membersToMove.length)] });

        if (targetChannels.length > 1) {
            membersToMove.sort(() => Math.random() - 0.5);
        }

        let movedCount = 0;
        let lastEditTime = Date.now();

        for (const member of membersToMove) {
            const targetChannel = targetChannels[movedCount % targetChannels.length];

            try {
                if (member.voice.channelId === sourceChannel.id) {
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
                await replyMsg.edit({ embeds: [buildProgressEmbed(movedCount, membersToMove.length)] }).catch(() => {});
                await delay(300);
            }
        }

        await replyMsg.edit({ embeds: [buildProgressEmbed(membersToMove.length, membersToMove.length, true)] }).catch(() => {});
        
        const { logModAction } = require('./utils/logHelper');
        await logModAction(message.guild, {
            action: 'VMOVEALL',
            moderator: message.author,
            details: `A déplacé ${membersToMove.length} membre(s) depuis ${sourceChannel.name} vers ${targetChannels.length} salon(s).`,
            color: 0x5865F2
        }).catch(() => {});
    }
};
