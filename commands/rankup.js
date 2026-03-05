const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { ROLES, MOD_CHANNEL_ID, ADMIN_PING_ID, checkPermission } = require('./utils/permHelper');

const USAGE_FILE = path.join(__dirname, '../rankupUsage.json');

function loadUsage() {
    if (fs.existsSync(USAGE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveUsage(data) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rankup')
        .setDescription('Promote a member to Perm I or Perm II (SOUVERAIN only)')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The member to promote')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('The rank to assign')
                .setRequired(true)
                .addChoices(
                    { name: 'Perm I', value: 'PERM_1' },
                    { name: 'Perm II', value: 'PERM_2' }
                )),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(ROLES.SOUVERAIN)) {
            return interaction.reply({ content: '❌ Seul un **SOUVERAIN** peut utiliser cette commande.', flags: 64 });
        }

        const target = interaction.options.getMember('target');
        const rankKey = interaction.options.getString('rank');
        const roleId = ROLES[rankKey];

        if (!target) return interaction.reply({ content: '❌ Utilisateur introuvable.', flags: 64 });

        // 1. Condition d'ancienneté (14 jours)
        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        const joinedAt = target.joinedTimestamp;
        if (Date.now() - joinedAt < fourteenDays) {
            return interaction.reply({ content: '❌ La cible doit être sur le serveur depuis au moins **14 jours**.', flags: 64 });
        }

        // 2. Quota strict (1/7j)
        const usage = loadUsage();
        const lastUsed = usage[interaction.user.id] || 0;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        
        if (Date.now() - lastUsed < sevenDays) {
            const nextAvailable = new Date(lastUsed + sevenDays);
            return interaction.reply({ 
                content: `❌ Quota atteint. Vous pourrez réutiliser cette commande le <t:${Math.floor(nextAvailable.getTime() / 1000)}:F>.`, 
                flags: 64 
            });
        }

        // 3. Application du rôle
        try {
            await target.roles.add(roleId);
            
            // Enregistrer l'usage
            usage[interaction.user.id] = Date.now();
            saveUsage(usage);

            // 4. Log Prioritaire
            const logChannel = await interaction.guild.channels.fetch(MOD_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('📢 PROMOTION PRIORITAIRE')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: 'Souverain', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                        { name: 'Cible', value: `${target} (\`${target.id}\`)`, inline: true },
                        { name: 'Rang attribué', value: rankKey, inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ 
                    content: `<@&${ADMIN_PING_ID}>`, 
                    embeds: [embed] 
                });
            }

            await interaction.reply({ content: `✅ **${target.user.tag}** a été promu au rang **${rankKey}** !` });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Erreur lors de la promotion. Vérifiez mes permissions.', flags: 64 });
        }
    },

    async executeMessage(message, args) {
        if (!message.member.roles.cache.has(ROLES.SOUVERAIN)) {
            return message.reply('❌ Seul un **SOUVERAIN** peut utiliser cette commande.');
        }

        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        const rankArg = args[1]?.toLowerCase();

        if (!target) return message.reply('Usage: -rankup @target [perm1/perm2]');
        
        let rankKey, roleId;
        if (rankArg === 'perm1') { rankKey = 'PERM_1'; roleId = ROLES.PERM_1; }
        else if (rankArg === 'perm2') { rankKey = 'PERM_2'; roleId = ROLES.PERM_2; }
        else return message.reply('Veuillez spécifier le rang : `perm1` ou `perm2`');

        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        if (Date.now() - target.joinedTimestamp < fourteenDays) {
            return message.reply('❌ La cible doit être sur le serveur depuis au moins **14 jours**.');
        }

        const usage = loadUsage();
        const lastUsed = usage[message.author.id] || 0;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        
        if (Date.now() - lastUsed < sevenDays) {
            const nextAvailable = new Date(lastUsed + sevenDays);
            return message.reply(`❌ Quota atteint. Dispo le <t:${Math.floor(nextAvailable.getTime() / 1000)}:F>.`);
        }

        try {
            await target.roles.add(roleId);
            usage[message.author.id] = Date.now();
            saveUsage(usage);

            const logChannel = await message.guild.channels.fetch(MOD_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('📢 PROMOTION PRIORITAIRE')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: 'Souverain', value: `${message.author.tag}`, inline: true },
                        { name: 'Cible', value: `${target.user.tag}`, inline: true },
                        { name: 'Rang attribué', value: rankKey, inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ content: `<@&${ADMIN_PING_ID}>`, embeds: [embed] });
            }

            await message.reply(`✅ **${target.user.tag}** a été promu **${rankKey}** !`);
        } catch (e) {
            message.reply('Erreur promotion.');
        }
    }
};
