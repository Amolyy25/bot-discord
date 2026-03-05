const { Client, GatewayIntentBits, Collection, REST, Routes, Partials, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const http = require('http');
const cron = require('node-cron');
const statsCommand = require('./commands/stats.js');
const antispam = require('./commands/utils/antispamHelper');
const jackpot = require('./commands/utils/jackpotHelper');
const antinuke = require('./commands/utils/antiNukeHelper');
const { initDB } = require('./commands/utils/db');
const { migrateSanctions } = require('./commands/utils/sanctionsHelper');
const { ROLES } = require('./commands/utils/permHelper');
const { AuditLogEvent } = require('discord.js');

// Petit serveur HTTP pour le Health Check (port 8000 par défaut ou celui de l'hébergeur)
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Bot is alive!');
    res.end();
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`Le port ${PORT} est déjà utilisé. Le Health Check ne pourra pas démarrer sur ce port.`);
    } else {
        console.error('Erreur du serveur Health Check:', err);
    }
});

server.listen(PORT, () => {
    console.log(`Port ${PORT} ouvert pour le Health Check`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions, // Ajout de l'intent pour les réactions
        GatewayIntentBits.GuildPresences // Requis pour le comptage des membres en ligne
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction] // Ajout des partiels pour gérer les messages non cachés
});

client.commands = new Collection();
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`Commande chargée: ${command.data.name}`);
    }
}

// Enregistrer les commandes slash
const rest = new REST().setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Enregistrement des commandes slash...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Commandes slash enregistrées avec succès!');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des commandes:', error);
    }
})();

// Snipe system
const snipes = new Collection();

// Système de Bienvenue
client.on(Events.GuildMemberAdd, async (member) => {
    const welcomeChannelId = '1469071691941412962'; // Salon Général
    try {
        const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(`${member.user.username} a rejoint !`)
            .setDescription(`*Tu es le bienvenu, amuse-toi bien ici ! Pour obtenir un boost d'xp x2 pendant 1 semaine et le <@&1471431323645378766> envoie ton premier message dans le chat !*`)
            .setColor(0xFFFFFF);

        await channel.send({ content: `<@${member.id}> <@&1476171525471076536>`, embeds: [embed] });

        // Enregistrer le nouveau membre pour sa récompense de premier message
        const pendingRewardsFile = path.join(__dirname, 'pendingRewards.json');
        let pendingRewards = [];
        if (fs.existsSync(pendingRewardsFile)) {
            try {
                pendingRewards = JSON.parse(fs.readFileSync(pendingRewardsFile, 'utf8'));
            } catch (err) {
                console.error('Error reading pendingRewards.json:', err);
            }
        }
        if (!pendingRewards.includes(member.id)) {
            pendingRewards.push(member.id);
            fs.writeFileSync(pendingRewardsFile, JSON.stringify(pendingRewards, null, 2));
        }

    } catch (error) {
        console.error('Erreur lors de l\'envoi du message de bienvenue:', error);
    }
});

client.on('messageDelete', async (message) => {
    if (!message.author || message.author.bot || !message.content || message.content.length === 0) return;
    
    if (!snipes.has(message.channel.id)) {
        snipes.set(message.channel.id, []);
    }
    
    const channelSnipes = snipes.get(message.channel.id);
    channelSnipes.unshift({
        content: message.content || '',
        author: message.author,
        image: message.attachments.first()?.url || null,
        timestamp: Date.now()
    });
    
    // Garder seulement les 15 derniers snipes par salon
    if (channelSnipes.length > 15) {
        channelSnipes.pop();
    }
});

// --- Système Anti-Nuke (Surveillance Events) ---

// Mass Ban
client.on(Events.GuildBanAdd, async (ban) => {
    try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const banLog = fetchedLogs.entries.first();
        if (banLog && banLog.executorId) {
            await antinuke.trackStaffAction(ban.guild, banLog.executorId, 'BAN_KICK');
        }
    } catch (e) {}
});

// Mass Kick
client.on(Events.GuildMemberRemove, async (member) => {
    try {
        const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
        const kickLog = fetchedLogs.entries.first();
        if (kickLog && kickLog.targetId === member.id && (Date.now() - kickLog.createdTimestamp < 5000)) {
            await antinuke.trackStaffAction(member.guild, kickLog.executorId, 'BAN_KICK');
        }
    } catch (e) {}
});

// Mass Channels
client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
        const log = fetchedLogs.entries.first();
        if (log && log.executorId) await antinuke.trackStaffAction(channel.guild, log.executorId, 'CHANNELS_ROLES');
    } catch (e) {}
});

client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const log = fetchedLogs.entries.first();
        if (log && log.executorId) await antinuke.trackStaffAction(channel.guild, log.executorId, 'CHANNELS_ROLES');
    } catch (e) {}
});

// Mass Roles
client.on(Events.RoleCreate, async (role) => {
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
        const log = fetchedLogs.entries.first();
        if (log && log.executorId) await antinuke.trackStaffAction(role.guild, log.executorId, 'CHANNELS_ROLES');
    } catch (e) {}
});

client.on(Events.RoleDelete, async (role) => {
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
        const log = fetchedLogs.entries.first();
        if (log && log.executorId) await antinuke.trackStaffAction(role.guild, log.executorId, 'CHANNELS_ROLES');
    } catch (e) {}
});

// Mass Promotion / Roles addition
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    if (addedRoles.size > 0) {
        try {
            const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
            const log = fetchedLogs.entries.first();
            if (log && log.executorId && log.executorId !== client.user.id) {
                const importantRoles = [ROLES.PERM_1, ROLES.PERM_2, ROLES.PERM_3, ROLES.PERM_4, ROLES.PERM_5, ROLES.SOUVERAIN];
                if (addedRoles.some(r => importantRoles.includes(r.id) || r.permissions.has(PermissionFlagsBits.Administrator))) {
                    await antinuke.trackStaffAction(newMember.guild, log.executorId, 'PROMOTIONS');
                }
            }
        } catch (e) {}
    }
});

// Anti-Webhook
client.on(Events.WebhooksUpdate, async (channel) => {
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate });
        const log = fetchedLogs.entries.first();
        if (log && log.executorId && log.executorId !== channel.guild.ownerId) {
            const staffMember = await channel.guild.members.fetch(log.executorId).catch(() => null);
            await antinuke.sanctionStaff(channel.guild, staffMember, 'Création de Webhook (Owner Only)');
        }
    } catch (e) {}
});

client.on('interactionCreate', async interaction => {
    // Gestion des boutons du système de signalement
    if (interaction.isButton() && interaction.customId.startsWith('signaler_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1]; // tempmute, ban, mute, traite, ticket, abus
        
        // Nouvelles permissions demandées
        const PERM_TEMPMUTE = '1469071689831940310'; // Minimum pour tempmute/ticket
        const PERM_BAN = '1469071689831940309';      // Tout faire (incluant ban)
        const PERM_MUTE_DEF = '1469071689831940308'; // Tout faire sauf ban

        const { PermissionFlagsBits, ChannelType, OverwriteType } = require('discord.js');
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        
        const canBan = isAdmin || interaction.member.roles.cache.has(PERM_BAN);
        const canMuteDef = canBan || interaction.member.roles.cache.has(PERM_MUTE_DEF);
        const canStaff = canMuteDef || interaction.member.roles.cache.has(PERM_TEMPMUTE);

        // Vérification des permissions selon l'action
        if (action === 'ban' && !canBan) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de bannir (Role requis: 1469071689831940309).', flags: 64 });
        }
        if (action === 'mute' && !canMuteDef) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de mute définitif (Role requis: 1469071689831940308).', flags: 64 });
        }
        if (!canStaff) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de modérer (Role minimum requis: 1469071689831940310).', flags: 64 });
        }

        // Extraction des IDs
        let targetId, reporterId;
        if (action === 'tempmute') {
            targetId = parts[3];
            reporterId = parts[4];
        } else if (action === 'abus') {
            reporterId = parts[2];
        } else {
            targetId = parts[2];
            reporterId = parts[3];
        }

        const { addSanction } = require('./commands/utils/sanctionsHelper');
        const { logModAction } = require('./commands/utils/logHelper');
        const { setMutedState } = require('./commands/utils/antispamHelper');

        try {
            if (action === 'tempmute') {
                const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (!targetMember) return interaction.reply({ content: '❌ Utilisateur introuvable.', flags: 64 });

                const durationType = parts[2]; // 10m, 15m, 30m
                let durationMs, durationLabel;
                switch (durationType) {
                    case '10m': durationMs = 10 * 60 * 1000; durationLabel = '10 minutes'; break;
                    case '15m': durationMs = 15 * 60 * 1000; durationLabel = '15 minutes'; break;
                    case '30m': durationMs = 30 * 60 * 1000; durationLabel = '30 minutes'; break;
                    default: return interaction.reply({ content: 'Durée invalide.', flags: 64 });
                }

                await targetMember.timeout(durationMs, `Signalement - Action rapide par ${interaction.user.tag}`);
                await addSanction(interaction.guild.id, targetId, 'tempmute', '2', interaction.user.tag, 'Via Signalement', 'Autre', `Tempmute ${durationLabel}`, durationType);
                
                await logModAction(interaction.guild, {
                    action: 'TEMPMUTE',
                    moderator: interaction.user,
                    target: targetMember.user,
                    reason: `Via Signalement - ${durationLabel}`,
                    details: `Durée: ${durationLabel}`,
                    color: 0xFFA500
                });

                await interaction.reply({ content: `✅ **${targetMember.user.tag}** a été rendu muet pour ${durationLabel}.`, flags: 64 });

            } else if (action === 'ban') {
                await interaction.guild.bans.create(targetId, { reason: `Signalement - Action rapide par ${interaction.user.tag}` });
                await addSanction(interaction.guild.id, targetId, 'ban', '3', interaction.user.tag, 'Via Signalement', 'Autre', 'Bannissement', 'permanent');
                
                const targetUserObj = await client.users.fetch(targetId).catch(() => ({ tag: 'Inconnu', id: targetId }));
                await logModAction(interaction.guild, {
                    action: 'BAN',
                    moderator: interaction.user,
                    target: targetUserObj,
                    reason: 'Via Signalement',
                    details: 'Bannissement définitif',
                    color: 0xFF0000
                });

                await interaction.reply({ content: `✅ **${targetUserObj.tag || targetId}** a été banni.`, flags: 64 });

            } else if (action === 'mute') {
                 const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
                 if (!targetMember) return interaction.reply({ content: '❌ Utilisateur introuvable.', flags: 64 });

                 setMutedState(targetId);
                 await targetMember.timeout(28 * 24 * 60 * 60 * 1000, `Signalement - Mute Def par ${interaction.user.tag}`);

                 await addSanction(interaction.guild.id, targetId, 'mute', '3', interaction.user.tag, 'Via Signalement', 'Autre', 'Mute Définitif', 'permanent');

                 await logModAction(interaction.guild, {
                    action: 'MUTE PERMANENT',
                    moderator: interaction.user,
                    target: targetMember.user,
                    reason: 'Via Signalement',
                    details: 'Mute définitif',
                    color: 0xFF0000
                });

                await interaction.reply({ content: `✅ **${targetMember.user.tag}** a été rendu muet définitivement.`, flags: 64 });
            
            } else if (action === 'traite') {
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                const modal = new ModalBuilder()
                    .setCustomId(`modal_signaler_traite_${targetId}`)
                    .setTitle('Marquer comme traité');

                const actionInput = new TextInputBuilder()
                    .setCustomId('actionInput')
                    .setLabel("Quelle action a été faite ?")
                    .setStyle(TextInputStyle.Paragraph);

                const firstActionRow = new ActionRowBuilder().addComponents(actionInput);
                modal.addComponents(firstActionRow);
                await interaction.showModal(modal);

            } else if (action === 'abus') {
                const reporterMember = await interaction.guild.members.fetch(reporterId).catch(() => null);
                if (!reporterMember) return interaction.reply({ content: '❌ Signaleur introuvable.', flags: 64 });

                const abuseDuration = 20 * 60 * 1000; // 20 minutes
                await reporterMember.timeout(abuseDuration, `Abus de la commande -signaler - Action par ${interaction.user.tag}`);
                
                await addSanction(interaction.guild.id, reporterId, 'tempmute', '1', interaction.user.tag, 'Abus Signalement', 'Autre', 'Mute 20m pour abus de signalement', '20m');

                await logModAction(interaction.guild, {
                    action: 'ABUS SIGNALEMENT',
                    moderator: interaction.user,
                    target: reporterMember.user,
                    reason: 'Abus de la commande -signaler',
                    details: 'Mute 20 minutes',
                    color: 0xFF0000
                });

                await interaction.reply({ content: `✅ **${reporterMember.user.tag}** a été mute 20m pour abus de la commande.`, flags: 64 });

            } else if (action === 'ticket') {
                const targetUserObj = await client.users.fetch(targetId).catch(() => null);
                const reporterUserObj = await client.users.fetch(reporterId).catch(() => null);
                
                if (!targetUserObj || !reporterUserObj) return interaction.reply({ content: '❌ Impossible de récupérer les utilisateurs pour le ticket.', flags: 64 });

                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${targetUserObj.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: targetId,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                        {
                            id: reporterId,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                        // On n'autorise PAS le rôle PERM_TEMPMUTE (310)
                        { id: PERM_MUTE_DEF, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: PERM_BAN, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    ],
                    reason: `Création de ticket de signalement par ${interaction.user.tag}`
                });

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_close_${interaction.user.id}`)
                        .setLabel('Fermer le ticket')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({
                    content: `<@${targetId}> <@${reporterId}> <@${interaction.user.id}>`,
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Ticket de Signalement')
                            .setDescription(`Ce ticket a été ouvert par <@${interaction.user.id}> pour discuter du signalement concernant <@${targetId}> fait par <@${reporterId}>.\n\nMerci d'expliquer le problème calmement ici.`)
                            .setColor(0xFFFFFF)
                            .setTimestamp()
                    ],
                    components: [closeRow]
                });

                await interaction.reply({ content: `✅ Ticket créé : ${ticketChannel}`, flags: 64 });
            }

        } catch (error) {
            console.error('Erreur action rapide signalement:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'application de l\'action.', flags: 64 });
            }
        }
        return;
    }

    // Gestion fermeture ticket
    if (interaction.isButton() && interaction.customId.startsWith('ticket_close_')) {
        const openerId = interaction.customId.split('_')[2];
        const { PermissionFlagsBits } = require('discord.js');
        
        // Seul l'ouvreur ou un admin peut fermer
        if (interaction.user.id !== openerId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Seul le membre du staff ayant ouvert ce ticket (ou un administrateur) peut le fermer.', flags: 64 });
        }

        await interaction.reply({ content: 'Fermeture du ticket dans 5 secondes...' });
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
        return;
    }

    // Gestion du Modal Submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_signaler_traite_')) {
        const targetId = interaction.customId.split('_')[3];
        const actionDone = interaction.fields.getTextInputValue('actionInput');
        const { EmbedBuilder } = require('discord.js');

        const originalEmbed = interaction.message.embeds[0];
        const newEmbed = new EmbedBuilder(originalEmbed.data);
        
        newEmbed.setColor(0x00FF00); // Vert pour Traité
        newEmbed.addFields(
            { name: '✅ Traité par', value: interaction.user.tag, inline: true },
            { name: 'Action effectuée', value: actionDone, inline: true }
        );
        newEmbed.setTitle('Signalement Traité');

        // On peut retirer les boutons ou les laisser, ici on les modifie pour désactiver "traité"
        const components = interaction.message.components;
        // Optionnel: désactiver les boutons pour éviter le spam, ou juste laisser tel quel
        
        await interaction.message.edit({ embeds: [newEmbed], components: [] }); 
        await interaction.reply({ content: `✅ Signalement marqué comme traité.`, flags: 64 });
        return;
    }

    // Gestion du bouton "Devenir STAFF"
    if (interaction.isButton() && interaction.customId === 'staff_apply') {
        const categoryId = '1476976724481933407';
        const staffRoleId = '1469071689831940308';
        const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

        // Vérifier si un ticket existe déjà pour cet utilisateur dans cette catégorie
        const existingChannel = interaction.guild.channels.cache.find(c => 
            c.parentId === categoryId && 
            c.name === `staff-${interaction.user.username.toLowerCase()}`
        );

        if (existingChannel) {
            return interaction.reply({ content: `❌ Vous avez déjà un ticket ouvert : ${existingChannel}`, flags: 64 });
        }

        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: `staff-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
                    },
                    {
                        id: staffRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
                    }
                ],
                reason: `Candidature Staff de ${interaction.user.tag}`
            });

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('staff_ticket_close')
                    .setLabel('Fermer le ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('CANDIDATURE STAFF')
                .setDescription(`Bonjour <@${interaction.user.id}>,\n\nMerci de l'intérêt que vous portez au SECTEUR ! Un membre de la haute société (<@&${staffRoleId}>) va s'occuper de vous d'ici peu.\n\nEn attendant, n'hésitez pas à préparer votre présentation.`)
                .setColor(0xFFFFFF)
                .setTimestamp();

            await ticketChannel.send({
                content: `<@${interaction.user.id}> | <@&${staffRoleId}>`,
                embeds: [welcomeEmbed],
                components: [closeRow]
            });

            await interaction.reply({ content: `✅ Votre ticket a été créé : ${ticketChannel}`, flags: 64 });
        } catch (error) {
            console.error('Erreur lors de la création du ticket staff:', error);
            await interaction.reply({ content: '❌ Une erreur est survenue lors de la création de votre ticket.', flags: 64 });
        }
        return;
    }

    // Gestion de la fermeture du ticket STAFF
    if (interaction.isButton() && interaction.customId === 'staff_ticket_close') {
        const staffRoleId = '1469071689831940308';
        const { PermissionFlagsBits } = require('discord.js');

        if (!interaction.member.roles.cache.has(staffRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Seul un membre du staff ou un administrateur peut fermer ce ticket.', flags: 64 });
        }

        await interaction.reply({ content: 'Fermeture du ticket dans 5 secondes...' });
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
        return;
    }

    // Gestion des boutons de rôles
    if (interaction.isButton() && interaction.customId.startsWith('role_')) {
        const roleId = interaction.customId.split('_')[1];
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
            return interaction.reply({ content: '❌ Ce rôle n\'existe plus.', flags: 64 });
        }

        try {
            if (interaction.member.roles.cache.has(roleId)) {
                await interaction.member.roles.remove(roleId);
                await interaction.reply({ content: `✅ Le rôle **${role.name}** vous a été retiré.`, flags: 64 });
            } else {
                await interaction.member.roles.add(roleId);
                await interaction.reply({ content: `✅ Le rôle **${role.name}** vous a été attribué.`, flags: 64 });
            }
        } catch (error) {
            console.error('Erreur lors du changement de rôle:', error);
            await interaction.reply({ content: '❌ Impossible de modifier vos rôles. Vérifiez mes permissions.', flags: 64 });
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Vérification des permissions et quotas
    const { checkPermission } = require('./commands/utils/permHelper');
    const permResult = checkPermission(interaction.member, interaction.commandName);
    
    if (permResult === 'quota_reached') {
        return interaction.reply({ content: '❌ Quota d\'utilisation horaire atteint pour cette commande.', flags: 64 });
    } else if (permResult !== true) {
        return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', flags: 64 });
    }

    try {
        await command.execute(interaction, client, snipes);
        
        // Surveillance Anti-Nuke pour les commandes de modération
        const modCommands = ['kick', 'ban'];
        if (modCommands.includes(interaction.commandName)) {
            await antinuke.trackStaffAction(interaction.guild, interaction.user.id, 'BAN_KICK');
        }

        // Vérifier si un rôle doit être consommé
        try {
            const { checkAndConsumeRole } = require('./commands/utils/permHelper');
            await checkAndConsumeRole(interaction.member, interaction.commandName);
        } catch (e) {}
    } catch (error) {
        console.error(error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Erreur lors de l\'exécution de la commande!', flags: 64 });
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // ══ Anti-Spam / Anti-Raid ══
    // Vérifie AVANT tout le reste (priorité haute)
    const handled = await antispam.handleMessage(message);
    if (handled) return; // Message traité par l'anti-spam, on arrête là

    // Gestion du premier message dans le salon général
    const welcomeChannelId = '1469071691941412962';
    if (message.channelId === welcomeChannelId) {
        const pendingRewardsFile = path.join(__dirname, 'pendingRewards.json');
        let pendingRewards = [];
        let isEligible = false;

        if (fs.existsSync(pendingRewardsFile)) {
            try {
                pendingRewards = JSON.parse(fs.readFileSync(pendingRewardsFile, 'utf8'));
                if (pendingRewards.includes(message.author.id)) {
                    isEligible = true;
                    // Retirer de la liste d'attente
                    pendingRewards = pendingRewards.filter(id => id !== message.author.id);
                    fs.writeFileSync(pendingRewardsFile, JSON.stringify(pendingRewards, null, 2));
                }
            } catch (err) {
                console.error('Error handling pendingRewards.json:', err);
            }
        }

        if (isEligible) {
            const roleX2 = '1470931333760155854'; // Role XP x2
            const roleOther = '1471431323645378766'; // Autre rôle mentionné dans le message
            
            const xpBoostsFile = path.join(__dirname, 'xpBoosts.json');
            let xpData = {};
            if (fs.existsSync(xpBoostsFile)) {
                try {
                    xpData = JSON.parse(fs.readFileSync(xpBoostsFile, 'utf8'));
                } catch (err) {
                    console.error('Error reading xpBoosts.json:', err);
                }
            }
            
            if (!xpData[message.author.id]) {
                // Enregistrer l'expiration
                xpData[message.author.id] = {
                    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 1 week
                };
                fs.writeFileSync(xpBoostsFile, JSON.stringify(xpData, null, 2));

                const member = message.member;
                if (member) {
                    try {
                        await member.roles.add([roleX2, roleOther]);
                    } catch (err) {
                        console.error('Error adding first message roles:', err);
                    }
                }
            }
        }
    }

    // Logique de Mirror (Troll)
    if (global.mirroredUsers && global.mirroredUsers.has(message.author.id)) {
        const expiration = global.mirroredUsers.get(message.author.id);
        if (Date.now() < expiration) {
            // Transformer le texte en sArCaStIc CaSe
            const content = message.content;
            let sarcastic = content.split('').map((char, i) => i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()).join('');
            
            // Ajouter des emojis troll
            const emojis = ['🤡', '👺', '🤥', '🐒', '💩'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            
            await message.channel.send(`${sarcastic} ${randomEmoji}`);
        } else {
            global.mirroredUsers.delete(message.author.id);
        }
    }

    if (!message.content.startsWith(process.env.PREFIX)) return;

    const args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    // Vérification des permissions et quotas
    const { checkPermission } = require('./commands/utils/permHelper');
    const permResult = checkPermission(message.member, commandName);
    
    if (permResult === 'quota_reached') {
        return message.reply('❌ Quota d\'utilisation horaire atteint pour cette commande.');
    } else if (permResult !== true) {
        return message.reply('❌ Vous n\'avez pas la permission d\'utiliser cette commande.');
    }

    try {
        await command.executeMessage(message, args, client, snipes);
        
        // Surveillance Anti-Nuke pour les commandes de modération
        const modCommands = ['kick', 'ban'];
        if (modCommands.includes(commandName)) {
            await antinuke.trackStaffAction(message.guild, message.author.id, 'BAN_KICK');
        }

        // Vérifier si un rôle doit être consommé
        try {
            const { checkAndConsumeRole } = require('./commands/utils/permHelper');
            await checkAndConsumeRole(message.member, commandName);
        } catch (e) {}
    } catch (error) {
        console.error(error);
        message.reply('Erreur lors de l\'exécution de la commande!');
    }
});

// Logique Anti-Evasion Prison (Troll)
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!newState.channelId) return; // Déconnexion, on s'en fiche
    if (newState.channelId && oldState.channelId === newState.channelId) return; // Pas de changement de salon

    if (global.prisonniers && global.prisonniers.has(newState.id)) {
        const data = global.prisonniers.get(newState.id);
        if (Date.now() < data.expiration) {
            if (newState.channelId !== data.channelId) {
                // Tentative d'évasion !
                try {
                    await newState.setChannel(data.channelId, 'Tentative d\'évasion du cachot !');
                } catch (error) {
                    console.error('Impossible de ramener le prisonnier:', error);
                }
            }
        } else {
            global.prisonniers.delete(newState.id);
        }
    }
});

// Utilisez Events.ClientReady (v14+) pour éviter le warning
client.once(Events.ClientReady, () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    // Initialiser la DB et migrer si besoin
    initDB().then(() => {
        migrateSanctions();
    });

    // Initialiser l'anti-spam
    antispam.init(client);

    // Initialiser le Jackpot Chrono
    jackpot.init(client);

    // Cron job pour le Jackpot Chrono (Check toutes les minutes pour être précis)
    cron.schedule('* * * * *', () => {
        jackpot.checkCron(client);
    }, {
        timezone: "Europe/Paris"
    });

    // Cron job pour retirer le rôle xp x2
    cron.schedule('0 * * * *', async () => {
        const xpBoostsFile = path.join(__dirname, 'xpBoosts.json');
        if (!fs.existsSync(xpBoostsFile)) return;

        try {
            const xpData = JSON.parse(fs.readFileSync(xpBoostsFile, 'utf8'));
            const now = Date.now();
            let changed = false;

            // guild id = 1469071689559281734
            // role = 1470931333760155854
            const roleX2 = '1470931333760155854';
            const guild = client.guilds.cache.first(); // Assuming single guild or cache has it
            if (!guild) return;

            for (const [userId, data] of Object.entries(xpData)) {
                if (now > data.expiresAt) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member && member.roles.cache.has(roleX2)) {
                        await member.roles.remove(roleX2).catch(console.error);
                    }
                    delete xpData[userId];
                    changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(xpBoostsFile, JSON.stringify(xpData, null, 2));
            }
        } catch (err) {
            console.error('Error in xpBoosts cron job:', err);
        }
    });

    // Cron job à 9h00
    cron.schedule('0 9 * * *', async () => {
        console.log('Exécution de la tâche cron pour les stats...');
        const statsChannelId = '1469073406917083308';
        
        try {
            const channel = await client.channels.fetch(statsChannelId);
            if (!channel) return console.error('Salon stats introuvable');

            const guild = channel.guild;
            await guild.members.fetch();
            
            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;
            const boostCount = guild.premiumSubscriptionCount || 0;
            const boostLevel = guild.premiumTier;

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle(`<:love:1470917973819658304> Rapport Quotidien - ${guild.name}`)
                .setDescription(`*Voici les statistiques du serveur du ${new Date().toLocaleDateString('fr-FR')}*`)
                .addFields(
                    { name: 'Membres', value: `\`${totalMembers}\` membres au total`, inline: true },
                    { name: 'En ligne', value: `\`${onlineMembers}\` membres actifs`, inline: true },
                    { name: 'Boosts', value: `\`${boostCount}\` boosts (Niveau ${boostLevel})`, inline: true }
                )
                .setColor(0xFFFFFF)
                .setFooter({ text: 'LE SECTEUR STATISTIQUES' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log('Stats envoyées avec succès à 9h00');
        } catch (error) {
            console.error('Erreur lors de l\'envoi des stats cron:', error);
        }
    }, {
        timezone: "Europe/Paris"
    });
});

client.login(process.env.TOKEN);