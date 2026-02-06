const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { addSanction, INFRACTION_CONFIG } = require('./utils/sanctionsHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un utilisateur (Interface interactive)')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à bannir')
                .setRequired(true)),

    async execute(interaction) {
        const { isStaff, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(interaction.member);
        if (!isModChannel(interaction.channelId) && !adminStatus) return;
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        const target = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        // Even if member is null, we might want to ban by ID
        const bannable = member ? member.bannable : true;
        
        if (!bannable) return interaction.reply({ content: 'Je ne peux pas bannir cet utilisateur!', ephemeral: true });
        if (member && member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'Vous ne pouvez pas modérer quelqu\'un avec un rôle égal ou supérieur!', ephemeral: true });
        }

        await startInteractiveBan(interaction, target, member);
    },

    async executeMessage(message, args) {
        const { isStaff, isModChannel, isAdmin } = require('./utils/permHelper');
        const adminStatus = isAdmin(message.member);
        if (!isModChannel(message.channel.id) && !adminStatus) return;
        if (!isStaff(message.member)) {
            return message.reply('non ta pas la perm');
        }

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -ban @utilisateur ou ID');

        const member = await message.guild.members.fetch(target.id).catch(() => null);
        const bannable = member ? member.bannable : true;
        if (!bannable) return message.reply('Je ne peux pas bannir cet utilisateur!');

        await startInteractiveBan(message, target, member);
    }
};

async function startInteractiveBan(context, target, member) {
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
                .setCustomId('confirm_ban')
                .setLabel('Confirmer le Bannissement')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!selections.category || !selections.level),
            new ButtonBuilder()
                .setCustomId('cancel_ban')
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Danger)
        );
        rows.push(rowButton);

        return rows;
    };

    const embed = {
        color: 0x5865F2,
        title: 'Configuration du Bannissement',
        description: `Configuration de la sanction pour **${target.tag}**`,
        fields: [
            { name: 'Catégorie', value: selections.category || 'Non sélectionnée', inline: true },
            { name: 'Gravité', value: selections.gravityLabel || 'Non sélectionnée', inline: true }
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
        } else if (i.customId === 'confirm_ban') {
            try {
                await i.guild.bans.create(target.id, { reason: `Ban par ${user.tag} - ${selections.gravityLabel}` });
                addSanction(i.guild.id, target.id, 'ban', selections.level, user.tag, null, selections.category, selections.gravityLabel, 'permanent');

                const { logModAction } = require('./utils/logHelper');
                await logModAction(i.guild, {
                    action: 'BAN',
                    moderator: user,
                    target: target,
                    reason: selections.gravityLabel,
                    details: `Catégorie: ${selections.category}`,
                    color: 0xFF0000
                });

                const finalEmbed = {
                    color: 0xFF0000,
                    title: 'Utilisateur Banni',
                    description: `${target.tag} a été banni définitivement du serveur.`,
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
        } else if (i.customId === 'cancel_ban') {
            await i.update({ content: 'Sanction annulée.', embeds: [], components: [] });
            collector.stop();
        }

        embed.fields[0].value = selections.category || 'Non sélectionnée';
        embed.fields[1].value = selections.gravityLabel || 'Non sélectionnée';
        
        await i.update({ embeds: [embed], components: createRows() });
    });
}