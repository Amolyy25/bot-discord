const { SlashCommandBuilder } = require('discord.js');
const trust = require('./utils/trustHelper');
const { checkPermission } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shadowmute')
        .setDescription('Active/Désactive le mode fantôme (Perm V+)')
        .addUserOption(option => option.setName('cible').setDescription('Le membre').setRequired(true)),
    
    async execute(interaction) {
        const hasPerm = await checkPermission(interaction.member, 'shadowmute');
        if (!hasPerm) return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', flags: 64 });

        const target = interaction.options.getUser('cible');
        const data = await trust.getTrustData(target.id);
        const newStatus = !data.is_shadow_muted;

        await trust.setShadowMute(target.id, newStatus);

        await interaction.reply({ 
            content: `✅ Le mode Shadow Mute est désormais **${newStatus ? 'ACTIF' : 'INACTIF'}** pour **${target.tag}**.` 
        });
    },

    async executeMessage(message, args) {
        const hasPerm = await checkPermission(message.member, 'shadowmute');
        if (!hasPerm) return;

        const target = message.mentions.members.first();
        if (!target) return message.channel.send('❌ Usage: `-shadowmute @membre`');

        const data = await trust.getTrustData(target.id);
        const newStatus = !data.is_shadow_muted;

        await trust.setShadowMute(target.id, newStatus);
        await message.channel.send(`✅ Le mode Shadow Mute est désormais **${newStatus ? 'ACTIF' : 'INACTIF'}** pour **${target.user.tag}**.`);
    }
};
