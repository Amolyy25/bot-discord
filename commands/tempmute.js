const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { addSanction, parseDuration, INFRACTION_CONFIG } = require('./utils/sanctionsHelper');
const { setMutedState } = require('./utils/antispamHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tempmute')
        .setDescription('Rend muet un utilisateur temporairement (Interface interactive)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à rendre muet')
                .setRequired(true)),

    async execute(interaction) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(interaction.member);
        
        // Vérification de permission
        if (!checkPermission(interaction.member, 'tempmute')) {
            return interaction.reply({ content: 'non ta pas la perm', flags: 64 });
        }
        
        if (!isModChannel(interaction.channelId) && !adminStatus) return;

        const target = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ content: 'Utilisateur non trouvé sur le serveur!', flags: 64 });
        if (!member.moderatable) return interaction.reply({ content: 'Je ne peux pas modérer cet utilisateur!', flags: 64 });
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'Vous ne pouvez pas modérer quelqu\'un avec un rôle égal ou supérieur!', flags: 64 });
        }

        await startInteractiveMute(interaction, target, member);
    },

    async executeMessage(message, args) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(message.member);
        
        // Vérification de permission
        if (!checkPermission(message.member, 'tempmute')) {
            return message.reply('non ta pas la perm');
        }

        if (!isModChannel(message.channel.id) && !adminStatus) return;

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -tempmute @utilisateur ou ID');

        const member = await message.guild.members.fetch(target.id).catch(() => null);
        if (!member) return message.reply('Utilisateur non trouvé!');
        if (!member.moderatable) return message.reply('Je ne peux pas modérer cet utilisateur!');

        await startInteractiveMute(message, target, member);
    }
};

async function startInteractiveMute(context, target, member) {
    const isInteraction = !!context.isCommand;
    const user = isInteraction ? context.user : context.author;

    let selections = {
        category: null,
        level: null,
        gravityLabel: null,
        duration: null
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
                value: lvl,
                description: `Durée: ${data.duration}`
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
                .setLabel('Confirmer le Mute')
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
        title: 'Configuration du Temp-Mute',
        description: `Configuration de la sanction pour **${target.tag}**`,
        fields: [
            { name: 'Catégorie', value: selections.category || 'Non sélectionnée', inline: true },
            { name: 'Gravité', value: selections.gravityLabel || 'Non sélectionnée', inline: true },
            { name: 'Durée', value: selections.duration || 'N/A', inline: true }
        ],
        footer: { text: 'Choisissez la catégorie pour voir les gravités adaptées.' }
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
            selections.duration = null;
        } else if (i.customId === 'select_level') {
            const data = INFRACTION_CONFIG[selections.category][i.values[0]];
            selections.level = i.values[0];
            selections.gravityLabel = data.label;
            selections.duration = data.duration;
        } else if (i.customId === 'confirm_mute') {
            const durationMs = parseDuration(selections.duration);
            await i.deferUpdate().catch(() => {});
            try {
                // Envoi du MP à l'utilisateur
                try {
                    await target.send({
                        embeds: [{
                            color: 0xFFA500,
                            title: 'Sanction : Mute Temporaire',
                            description: `Vous avez été rendu muet sur **${i.guild.name}**.`,
                            fields: [
                                { name: 'Raison', value: selections.gravityLabel, inline: true },
                                { name: 'Durée', value: selections.duration, inline: true }
                            ],
                            timestamp: new Date()
                        }]
                    });
                } catch (err) {
                    console.log(`Impossible d'envoyer un MP à ${target.tag}`);
                }

                // Timeout
                await member.timeout(durationMs, `Mute par ${user.tag} - ${selections.gravityLabel}`);
                
                setMutedState(target.id);

                // Add Muted role if exists
                const mutedRole = i.guild.roles.cache.find(r => r.name.toLowerCase() === 'muet' || r.name.toLowerCase() === 'muted');
                if (mutedRole) {
                    await member.roles.add(mutedRole).catch(() => {});
                    // Set timeout to remove role
                    setTimeout(() => {
                        member.roles.remove(mutedRole).catch(() => {});
                    }, durationMs);
                }

                await addSanction(i.guild.id, target.id, 'tempmute', selections.level, user.tag, null, selections.category, selections.gravityLabel);

                const { logModAction } = require('./utils/logHelper');
                await logModAction(i.guild, {
                    action: 'TEMPMUTE',
                    moderator: user,
                    target: target,
                    reason: selections.gravityLabel,
                    details: `Durée: ${selections.duration}\nCatégorie: ${selections.category}`,
                    color: 0x5865F2
                });

                const finalEmbed = {
                    color: selections.level === '3' ? 0xFF0000 : selections.level === '2' ? 0xFFA500 : 0x00FF00,
                    title: 'Sanction Appliquée',
                    description: `${target.tag} a été rendu muet.`,
                    fields: [
                        { name: 'Catégorie', value: selections.category, inline: true },
                        { name: 'Gravité', value: selections.gravityLabel, inline: true },
                        { name: 'Durée', value: selections.duration, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                };

                await i.editReply({ content: null, embeds: [finalEmbed], components: [] });
                return collector.stop('applied');
            } catch (error) {
                console.error(error);
                return i.followUp({ content: 'Erreur lors de l\'application de la sanction!', flags: 64 });
            }
        } else if (i.customId === 'cancel_mute') {
            await i.update({ content: 'Sanction annulée.', embeds: [], components: [] });
            return collector.stop('cancelled');
        }

        embed.fields[0].value = selections.category || 'Non sélectionnée';
        embed.fields[1].value = selections.gravityLabel || 'Non sélectionnée';
        embed.fields[2].value = selections.duration || 'N/A';
        
        await i.update({ embeds: [embed], components: createRows() });
    });
}