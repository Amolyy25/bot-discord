const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { loadPermissions } = require('./utils/permHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listperm')
        .setDescription('Liste toutes les permissions accordées via addperm')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Réservé aux admins pour éviter le spam

    async execute(interaction) {
        const perms = loadPermissions();
        const { COMMAND_PERMS, COMMAND_QUOTAS, ROLES } = require('./utils/permHelper');

        const embed = new EmbedBuilder()
            .setTitle('📂 Architecture des Permissions - LE SECTEUR')
            .setDescription('*Voici la configuration actuelle des accès et des quotas de modération.*')
            .setColor('#1a1a1a')
            .setThumbnail(interaction.guild.iconURL())
            .setTimestamp()
            .setFooter({ text: 'Système de Sécurité LANA v2', iconURL: interaction.client.user.displayAvatarURL() });

        // 1. Hiérarchie Statique
        const hierarchyText = [
            `👑 **ADMIN / OWN** (Accès Total)`,
            `🛡️ **SOUVERAIN** (<@&${ROLES.SOUVERAIN}>) - Rankup & Perm II/III`,
            `🎖️ **PERM V** (<@&${ROLES.PERM_5}>) - Soumis, Lock, BL`,
            `🎖️ **PERM IV** (<@&${ROLES.PERM_4}>) - Kick, Mute, VLock`,
            `🎖️ **PERM III** (<@&${ROLES.PERM_3}>) - Sanctions, VKick, Snipe`,
            `🎖️ **PERM II** (<@&${ROLES.PERM_2}>) - TempMute, Unmute, VMute`,
            `🎖️ **PERM I** (<@&${ROLES.PERM_1}>) - Warn, Info`
        ].join('\n');

        embed.addFields({ name: '📊 Hiérarchie Staff', value: hierarchyText });

        // 2. Quotas de Modération
        let quotaText = '';
        for (const [cmd, data] of Object.entries(COMMAND_QUOTAS)) {
            const windowMin = data.window / 60000;
            const windowText = windowMin >= 60 ? `${windowMin / 60}h` : `${windowMin}min`;
            quotaText += `• \`${cmd}\`: **${data.limit}** usages / ${windowText}\n`;
        }
        embed.addFields({ name: '⏳ Quotas de Sécurité', value: quotaText || 'Aucun quota configuré', inline: true });

        // 3. Permissions Dynamiques (addperm)
        let dynamicText = '';
        const allDynamicCmds = Object.keys(perms);
        
        if (allDynamicCmds.length === 0) {
            dynamicText = '*Aucune permission dynamique accordée.*';
        } else {
            for (const cmd of allDynamicCmds) {
                const data = perms[cmd];
                let targets = [];
                if (data.users?.length) targets.push(...data.users.map(id => `<@${id}>`));
                if (data.roles?.length) targets.push(...data.roles.map(id => {
                    const limit = data.roleLimits?.[id] ? ` (\`${data.roleLimits[id]}x\`)` : '';
                    return `<@&${id}>${limit}`;
                }));
                
                if (targets.length > 0) {
                    dynamicText += `🔹 \`${cmd}\`: ${targets.join(', ')}\n`;
                }
            }
        }
        embed.addFields({ name: '⚡ Accès Dynamiques (Addperm)', value: dynamicText || '*Aucun*', inline: false });

        await interaction.reply({ embeds: [embed] });
    },

    async executeMessage(message) {
        const { checkPermission } = require('./utils/permHelper');
        if (!checkPermission(message.member, 'listperm')) return;

        const perms = loadPermissions();
        const { COMMAND_PERMS, COMMAND_QUOTAS, ROLES } = require('./utils/permHelper');

        const embed = new EmbedBuilder()
            .setTitle('📂 Architecture des Permissions - LE SECTEUR')
            .setDescription('*Voici la configuration actuelle des accès et des quotas de modération.*')
            .setColor('#1a1a1a')
            .setThumbnail(message.guild.iconURL())
            .setTimestamp()
            .setFooter({ text: 'Système de Sécurité LANA v2', iconURL: message.client.user.displayAvatarURL() });

        const hierarchyText = [
            `👑 **ADMIN / OWN** (Accès Total)`,
            `🛡️ **SOUVERAIN** (<@&${ROLES.SOUVERAIN}>)`,
            `🎖️ **PERM V** (<@&${ROLES.PERM_5}>)`,
            `🎖️ **PERM IV** (<@&${ROLES.PERM_4}>)`,
            `🎖️ **PERM III** (<@&${ROLES.PERM_3}>)`,
            `🎖️ **PERM II** (<@&${ROLES.PERM_2}>)`,
            `🎖️ **PERM I** (<@&${ROLES.PERM_1}>)`
        ].join('\n');

        embed.addFields({ name: '📊 Hiérarchie Staff', value: hierarchyText });

        let quotaText = '';
        for (const [cmd, data] of Object.entries(COMMAND_QUOTAS)) {
            const windowMin = data.window / 60000;
            const windowText = windowMin >= 60 ? `${windowMin / 60}h` : `${windowMin}min`;
            quotaText += `• \`${cmd}\`: **${data.limit}** / ${windowText}\n`;
        }
        embed.addFields({ name: '⏳ Quotas', value: quotaText || 'Aucun', inline: true });

        let dynamicText = '';
        for (const cmd of Object.keys(perms)) {
            const data = perms[cmd];
            let targets = [];
            if (data.users?.length) targets.push(...data.users.map(id => `<@${id}>`));
            if (data.roles?.length) targets.push(...data.roles.map(id => {
                const limit = data.roleLimits?.[id] ? ` (\`${data.roleLimits[id]}x\`)` : '';
                return `<@&${id}>${limit}`;
            }));
            if (targets.length > 0) dynamicText += `🔹 \`${cmd}\`: ${targets.join(', ')}\n`;
        }
        embed.addFields({ name: '⚡ Accès Dynamiques', value: dynamicText || '*Aucun*', inline: false });

        message.reply({ embeds: [embed] });
    }
};