const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Envoie l\'embed de recrutement staff')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('RECRUTEMENT STAFF')
            .setDescription(`En pleine expansion, LE SECTEUR recherche des profils sérieux et investis pour assurer la gestion et l'animation de la communauté.\n\n**VOTRE RÔLE**\nEn tant que membre du staff, vous êtes le garant de l'image du serveur. Vous devez être accueillant, courtois et exemplaire. Votre mission consiste à veiller au respect des règles tout en dynamisant les échanges dans les salons textuels et vocaux.\n\n**CONDITIONS DE CANDIDATURE**\n\nActivité : 1 000 messages minimum sur les 30 derniers jours.\n\nPrésence : Au moins 2 heures d'activité en salons vocaux.\n\nÂge : 15 ans minimum.\n\n**POSTULER**\nSi vous êtes motivé à rejoindre la haute société du SECTEUR et à devenir un pilier de la structure, ouvrez un ticket pour déposer votre candidature.`)
            .setImage('https://i.pinimg.com/originals/79/50/1d/79501dc13ac2a55f456a7bf7882ece69.gif')
            .setColor(0xFFFFFF);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('staff_apply')
                .setLabel('Devenir STAFF')
                .setStyle(ButtonStyle.Secondary) // Style sober/clean like giveaways
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Message de recrutement envoyé !', flags: 64 });
    },

    async executeMessage(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Vous devez être administrateur pour utiliser cette commande.');
        }

        const embed = new EmbedBuilder()
            .setTitle('RECRUTEMENT STAFF')
            .setDescription(`En pleine expansion, LE SECTEUR recherche des profils sérieux et investis pour assurer la gestion et l'animation de la communauté.\n\n**VOTRE RÔLE**\nEn tant que membre du staff, vous êtes le garant de l'image du serveur. Vous devez être accueillant, courtois et exemplaire. Votre mission consiste à veiller au respect des règles tout en dynamisant les échanges dans les salons textuels et vocaux.\n\n**CONDITIONS DE CANDIDATURE**\n\nActivité : 1 000 messages minimum sur les 30 derniers jours.\n\nPrésence : Au moins 2 heures d'activité en salons vocaux.\n\nÂge : 15 ans minimum.\n\n**POSTULER**\nSi vous êtes motivé à rejoindre la haute société du SECTEUR et à devenir un pilier de la structure, ouvrez un ticket pour déposer votre candidature.`)
            .setImage('https://i.pinimg.com/originals/79/50/1d/79501dc13ac2a55f456a7bf7882ece69.gif')
            .setColor(0xFFFFFF);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('staff_apply')
                .setLabel('Devenir STAFF')
                .setStyle(ButtonStyle.Secondary)
        );

        await message.delete().catch(() => {});
        await message.channel.send({ embeds: [embed], components: [row] });
    }
};
