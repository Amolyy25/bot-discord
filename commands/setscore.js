const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const trust = require('./utils/trustHelper');
const { checkPermission } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setscore')
        .setDescription('Modifie manuellement le score de confiance (Perm V+)')
        .addUserOption(option => option.setName('cible').setDescription('Le membre').setRequired(true))
        .addIntegerOption(option => option.setName('score').setDescription('Le nouveau score (0-100)').setRequired(true).setMinValue(0).setMaxValue(100)),
    
    async execute(interaction) {
        const hasPerm = await checkPermission(interaction.member, 'setscore');
        if (!hasPerm) return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', flags: 64 });

        const target = interaction.options.getUser('cible');
        const score = interaction.options.getInteger('score');

        await trust.updateTrustScore(interaction.guild, target.id, score - (await trust.getTrustData(target.id)).trust_score, 'Modification manuelle par staff');

        await interaction.reply({ content: `✅ Score de **${target.tag}** mis à jour à **${score}/100**.` });
    },

    async executeMessage(message, args) {
        const hasPerm = await checkPermission(message.member, 'setscore');
        if (!hasPerm) return;

        let target = message.mentions.members.first();
        if (!target && args[0]) {
            target = await message.guild.members.fetch(args[0]).catch(() => null);
        }
        const score = parseInt(args[1]);

        if (!target || isNaN(score)) return message.channel.send('❌ Usage: `-setscore @membre/ID [0-100]`');

        await trust.updateTrustScore(message.guild, target.id, score - (await trust.getTrustData(target.id)).trust_score, 'Modification manuelle par staff');
        await message.channel.send(`✅ Score de **${target.user.tag}** mis à jour à **${score}/100**.`);
    }
};
