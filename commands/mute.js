const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { addSanction, INFRACTION_CONFIG } = require('./utils/sanctionsHelper');
const { setMutedState } = require('./utils/antispamHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Rend muet un utilisateur définitivement (Interface interactive)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à rendre muet')
                .setRequired(true)),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(interaction.member);
        
        // Vérification de permission
        if (!checkPermission(interaction.member, 'mute')) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        
        if (!isModChannel(interaction.channelId) && !adminStatus) return;

        const target = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ content: 'Utilisateur non trouvé!', ephemeral: true });
        if (!member.moderatable) return interaction.reply({ content: 'Je ne peux pas modérer cet utilisateur!', ephemeral: true });
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'Vous ne pouvez pas modérer quelqu\'un avec un rôle égal ou supérieur!', ephemeral: true });
        }

        await startInteractiveMutePermanent(interaction, target, member);
    },

    async executeMessage(message, args) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(message.member);
        
        // Vérification de permission
        if (!checkPermission(message.member, 'mute')) {
            return message.reply('non ta pas la perm');
        }

        if (!isModChannel(message.channel.id) && !adminStatus) return;

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -mute @utilisateur ou ID');

        const member = await message.guild.members.fetch(target.id).catch(() => null);
        if (!member) return message.reply('Utilisateur non trouvé!');
        if (!member.moderatable) return message.reply('Je ne peux pas modérer cet utilisateur!');

        await startInteractiveMutePermanent(message, target, member);
    }
};

async function startInteractiveMutePermanent(context, target, member) {
    const isInteraction = !!context.isCommand;
    const user = isInteraction ? context.user : context.author;

    let selections = {
        category: null,
        level: null,
        gravityLabel: null
    };

    const categories = Object.keys(INFRACTION_CONFIG).map(cat => ({
        label: cat,
        value: cat
    }));

    const createRows = () => {
        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_category')
                .setPlaceholder(selections.category || 'Choisissez la catégorie...')
                .addOptions(categories)
        );

        let rows = [row1];

        if (selections.category) {
            const levelOptions = Object.entries(INFRACTION_CONFIG[selections.category]).map(([lvl, data]) => ({
                label: data.label,
                value: lvl
            }));

            const row2 = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_level')
                    .setPlaceholder(selections.gravityLabel || 'Choisissez la gravité...')
                    .addOptions(levelOptions)
            );
            rows.push(row2);
        }

        const rowButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_mute')
                .setLabel('Confirmer le Mute Permanent')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!selections.category || !selections.level),
            new ButtonBuilder()
                .setCustomId('cancel_mute')
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Danger)
        );
        rows.push(rowButton);

        return rows;
    };

    const embed = {
        color: 0x5865F2,
        title: 'Configuration du Mute Permanent',
        description: `Configuration de la sanction pour **${target.tag}**`,
        fields: [
            { name: 'Catégorie', value: selections.category || 'Non sélectionnée', inline: true },
            { name: 'Gravité', value: selections.gravityLabel || 'Non sélectionnée', inline: true },
            { name: 'Durée', value: 'Permanent', inline: true }
        ]
    };

    const response = isInteraction 
        ? await context.reply({ embeds: [embed], components: createRows(), fetchReply: true })
        : await context.channel.send({ embeds: [embed], components: createRows() });

    const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === user.id,
        time: 120000
    });

    collector.on('collect', async i => {
        if (i.customId === 'select_category') {
            selections.category = i.values[0];
            selections.level = null;
            selections.gravityLabel = null;
        } else if (i.customId === 'select_level') {
            const data = INFRACTION_CONFIG[selections.category][i.values[0]];
            selections.level = i.values[0];
            selections.gravityLabel = data.label;
        } else if (i.customId === 'confirm_mute') {
            try {
                const mutedRole = i.guild.roles.cache.find(r => r.name.toLowerCase() === 'muet' || r.name.toLowerCase() === 'muted');
                if (mutedRole) {
                    await member.roles.add(mutedRole).catch(() => {});
                }
                
                setMutedState(target.id);
                
                await member.timeout(28 * 24 * 60 * 60 * 1000, `Mute Permanent: ${selections.gravityLabel}`);

                addSanction(i.guild.id, target.id, 'mute', selections.level, user.tag, null, selections.category, selections.gravityLabel, 'permanent');

                const { logModAction } = require('./utils/logHelper');
                await logModAction(i.guild, {
                    action: 'MUTE PERMANENT',
                    moderator: user,
                    target: target,
                    reason: selections.gravityLabel,
                    details: `Catégorie: ${selections.category}`,
                    color: 0x5865F2
                });

                const finalEmbed = {
                    color: selections.level === '3' ? 0xFF0000 : selections.level === '2' ? 0xFFA500 : 0x00FF00,
                    title: 'Sanction Appliquée',
                    description: `${target.tag} a été rendu muet définitivement.`,
                    fields: [
                        { name: 'Catégorie', value: selections.category, inline: true },
                        { name: 'Gravité', value: selections.gravityLabel, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                };

                await i.update({ content: null, embeds: [finalEmbed], components: [] });
                collector.stop();
            } catch (error) {
                console.error(error);
                return i.reply({ content: 'Erreur lors de l\'application de la sanction!', ephemeral: true });
            }
        } else if (i.customId === 'cancel_mute') {
            await i.update({ content: 'Sanction annulée.', embeds: [], components: [] });
            collector.stop();
        }

        embed.fields[0].value = selections.category || 'Non sélectionnée';
        embed.fields[1].value = selections.gravityLabel || 'Non sélectionnée';
        
        await i.update({ embeds: [embed], components: createRows() });
    });
}