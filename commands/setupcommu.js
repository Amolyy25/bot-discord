const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

// ─── IDs de configuration ─────────────────────────────────────────────────────
const CATEGORY_ID        = '1469071692172361830'; // Catégorie =commu
const VALIDATION_CHANNEL = '1479539379012898887'; // Salon de validation staff
const VALIDATOR_ROLE     = '1479539544864067636'; // Rôle autorisé à valider/refuser

// ─── Définition des salons communautaires ────────────────────────────────────
const CHANNELS_CONFIG = [
    {
        name: '│👘・vote2profil',
        key: 'vote2profil',
        embedTitle: '👘 VOTE2PROFIL — Votez pour vos favoris !',
        embedDesc: [
            '**Comment ça marche ?**',
            '> Cliquez sur le bouton ci-dessous pour voter pour le profil d\'un membre.',
            '> Un formulaire s\'ouvrira où vous pourrez choisir la personne et joindre une image.',
            '',
            '📌 **Règles :**',
            '• 1 vote par personne et par jour.',
            '• Les votes sont anonymes côté public.',
            '• Le vote est envoyé au staff pour validation avant publication.',
        ].join('\n'),
        embedColor: 0xE91E8C,
        buttonLabel: '🗳️ Voter pour un profil',
        buttonCustomId: 'commu_btn_vote2profil',
        buttonStyle: ButtonStyle.Primary,
    },
    {
        name: '│🗂️・les-dossiers',
        key: 'les_dossiers',
        embedTitle: '🗂️ LES DOSSIERS — Révélations & Archives',
        embedDesc: [
            '**Comment ça marche ?**',
            '> Cliquez sur le bouton ci-dessous pour soumettre une information confidentielle.',
            '> Vous pouvez joindre une image à votre dossier.',
            '',
            '📌 **Règles :**',
            '• La soumission est anonyme, votre identité n\'est jamais révélée publiquement.',
            '• Chaque dossier est validé par la staff avant publication.',
            '• Interdit : fausses informations, harcèlement, contenu illicite.',
        ].join('\n'),
        embedColor: 0xFF6B35,
        buttonLabel: '🗂️ Envoyer un Dossier',
        buttonCustomId: 'commu_btn_les_dossiers',
        buttonStyle: ButtonStyle.Secondary,
    },
    {
        name: '│👀・confession',
        key: 'confession',
        embedTitle: '👀 CONFESSION — Libérez-vous anonymement',
        embedDesc: [
            '**Comment ça marche ?**',
            '> Cliquez sur le bouton ci-dessous pour vous confesser.',
            '> Votre message sera publié avec un numéro de confession, totalement anonyme.',
            '',
            '📌 **Règles :**',
            '• Votre identité est **totalement** cachée, même pour les admins en public.',
            '• Chaque confession est validée par la staff avant publication.',
            '• Interdit : doxing, harcèlement, contenu illicite.',
        ].join('\n'),
        embedColor: 0x9B59B6,
        buttonLabel: '🤫 Se confesser',
        buttonCustomId: 'commu_btn_confession',
        buttonStyle: ButtonStyle.Danger,
    },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupcommu')
        .setDescription('Configure la catégorie communautaire (vote2profil, dossiers, confession)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // ── Slash Command ──────────────────────────────────────────────────────────
    async execute(interaction) {
        const { isAdmin } = require('./utils/permHelper');
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Réservé aux administrateurs.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });
        const result = await runSetup(interaction.guild);
        await interaction.editReply({ content: result });
    },

    // ── Prefix Command ─────────────────────────────────────────────────────────
    async executeMessage(message) {
        const { isAdmin } = require('./utils/permHelper');
        if (!isAdmin(message.member)) {
            return message.reply('❌ Réservé aux administrateurs.');
        }

        const msg = await message.reply('⏳ Configuration de la catégorie communautaire en cours...');
        const result = await runSetup(message.guild);
        await msg.edit(result);
    },

    // Exporter les constantes pour les utiliser dans index.js
    CATEGORY_ID,
    VALIDATION_CHANNEL,
    VALIDATOR_ROLE,
    CHANNELS_CONFIG,
};

// ─── Fonction principale de setup ─────────────────────────────────────────────
async function runSetup(guild) {
    const created = [];

    for (const config of CHANNELS_CONFIG) {
        try {
            // 1) Vérifier si le salon existe déjà (par nom)
            let channel = guild.channels.cache.find(
                c => c.parentId === CATEGORY_ID && c.name === config.name
            );

            // 2) Créer le salon s'il n'existe pas
            if (!channel) {
                channel = await guild.channels.create({
                    name: config.name,
                    type: ChannelType.GuildText,
                    parent: CATEGORY_ID,
                    reason: 'Setup communautaire (-setupcommu)',
                });
            }

            // 3) Supprimer les anciens messages du bot pour éviter les doublons
            const botMessages = await channel.messages.fetch({ limit: 20 });
            const toDelete = botMessages.filter(m => m.author.id === guild.client.user.id);
            for (const [, msg] of toDelete) {
                await msg.delete().catch(() => {});
            }

            // 4) Envoyer l'embed persistant + bouton
            const embed = new EmbedBuilder()
                .setTitle(config.embedTitle)
                .setDescription(config.embedDesc)
                .setColor(config.embedColor)
                .setFooter({ text: 'LE SECTEUR — Communauté', iconURL: guild.iconURL({ dynamic: true }) || undefined })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(config.buttonCustomId)
                    .setLabel(config.buttonLabel)
                    .setStyle(config.buttonStyle)
            );

            await channel.send({ embeds: [embed], components: [row] });

            created.push(`✅ ${config.name}`);
        } catch (err) {
            console.error(`[setupcommu] Erreur pour ${config.name}:`, err);
            created.push(`❌ ${config.name} (erreur: ${err.message})`);
        }
    }

    return `**Setup communautaire terminé :**\n${created.join('\n')}`;
}
