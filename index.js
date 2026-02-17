const { Client, GatewayIntentBits, Collection, REST, Routes, Partials, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const http = require('http');
const cron = require('node-cron');
const statsCommand = require('./commands/stats.js');
const antispam = require('./commands/utils/antispamHelper');
const jackpot = require('./commands/utils/jackpotHelper');

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
        GatewayIntentBits.GuildMessageReactions // Ajout de l'intent pour les réactions
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

        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle(`${member.user.username} à rejoint !`)
            .setDescription(`Tu es le bienvenue, amuse-toi bien ici ! N'hésite pas à aller faire un tour ici <#1471901439713612005> et <#1472918469409509418>`)
            .setImage('https://i.pinimg.com/originals/0c/b8/78/0cb8780082d2e46710a73f06c51285bb.gif')
            .setColor(0xFFFFFF);

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message de bienvenue:', error);
    }
});

client.on('messageDelete', async (message) => {
    if (message.author.bot || message.content.length === 0) return;
    
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

client.on('interactionCreate', async interaction => {
    // Gestion des boutons du système de signalement
    if (interaction.isButton() && interaction.customId.startsWith('signaler_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1]; // tempmute, ban, mute
        
        // Extraction de l'ID selon le format
        let targetId;
        if (action === 'tempmute') {
            targetId = parts[3];
        } else {
            targetId = parts[2];
        }

        // Rôle requis pour Ban et Mute Def
        const HIGH_STAFF_ROLE = '1471886110434132137';
        
        const { PermissionFlagsBits } = require('discord.js');
        const { addSanction } = require('./commands/utils/sanctionsHelper');
        const { logModAction } = require('./commands/utils/logHelper');
        const { setMutedState } = require('./commands/utils/antispamHelper');

        // Vérification des permissions
        if (action === 'ban' || action === 'mute') {
            if (!interaction.member.roles.cache.has(HIGH_STAFF_ROLE) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Vous n\'avez pas la permission requise (Haut Staff).', ephemeral: true });
            }
        } else if (action === 'tempmute') {
             // Pour tempmute, on accepte le rôle Staff (1471893729060192256) ou Haut Staff
             const STAFF_ROLE = '1471893729060192256';
             if (!interaction.member.roles.cache.has(STAFF_ROLE) && !interaction.member.roles.cache.has(HIGH_STAFF_ROLE)) {
                return interaction.reply({ content: '❌ Vous n\'avez pas la permission de modérer.', ephemeral: true });
             }
        }

        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!targetMember && action !== 'ban') { // On peut bannir par ID
             return interaction.reply({ content: '❌ Utilisateur introuvable ou parti du serveur.', ephemeral: true });
        }

        try {
            if (action === 'tempmute') {
                const durationType = parts[2]; // 10m, 15m, 30m

                let durationMs;
                let durationLabel;
                switch (durationType) {
                    case '10m': durationMs = 10 * 60 * 1000; durationLabel = '10 minutes'; break;
                    case '15m': durationMs = 15 * 60 * 1000; durationLabel = '15 minutes'; break;
                    case '30m': durationMs = 30 * 60 * 1000; durationLabel = '30 minutes'; break;
                    default: return interaction.reply({ content: 'Durée invalide.', ephemeral: true });
                }

                await targetMember.timeout(durationMs, `Signalement - Action rapide par ${interaction.user.tag}`);
                
                // Muted Role
                const mutedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'muet' || r.name.toLowerCase() === 'muted');
                if (mutedRole) {
                    await targetMember.roles.add(mutedRole).catch(() => {});
                    setMutedState(targetId);
                    setTimeout(() => {
                        targetMember.roles.remove(mutedRole).catch(() => {});
                    }, durationMs);
                }

                addSanction(interaction.guild.id, targetId, 'tempmute', '2', interaction.user.tag, 'Via Signalement', 'Autre', `Tempmute ${durationLabel}`, durationType);
                
                await logModAction(interaction.guild, {
                    action: 'TEMPMUTE',
                    moderator: interaction.user,
                    target: targetMember.user,
                    reason: `Via Signalement - ${durationLabel}`,
                    details: `Durée: ${durationLabel}`,
                    color: 0xFFA500
                });

                await interaction.reply({ content: `✅ **${targetMember.user.tag}** a été rendu muet pour ${durationLabel}.`, ephemeral: true });

            } else if (action === 'ban') {
                // parts[2] est l'ID
                await interaction.guild.bans.create(targetId, { reason: `Signalement - Action rapide par ${interaction.user.tag}` });
                
                addSanction(interaction.guild.id, targetId, 'ban', '3', interaction.user.tag, 'Via Signalement', 'Autre', 'Bannissement', 'permanent');
                 
                // On essaie de fetch user pour le log
                const targetUserObj = await client.users.fetch(targetId).catch(() => ({ tag: 'Inconnu', id: targetId }));

                await logModAction(interaction.guild, {
                    action: 'BAN',
                    moderator: interaction.user,
                    target: targetUserObj,
                    reason: 'Via Signalement',
                    details: 'Bannissement définitif',
                    color: 0xFF0000
                });

                await interaction.reply({ content: `✅ **${targetUserObj.tag || targetId}** a été banni.`, ephemeral: true });

            } else if (action === 'mute') {
                 // Mute Def
                 if (!targetMember) return interaction.reply({ content: '❌ Utilisateur introuvable.', ephemeral: true });

                 const mutedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'muet' || r.name.toLowerCase() === 'muted');
                 if (mutedRole) await targetMember.roles.add(mutedRole).catch(() => {});
                 
                 setMutedState(targetId);
                 await targetMember.timeout(28 * 24 * 60 * 60 * 1000, `Signalement - Mute Def par ${interaction.user.tag}`); // Max timeout ~28 jours

                 addSanction(interaction.guild.id, targetId, 'mute', '3', interaction.user.tag, 'Via Signalement', 'Autre', 'Mute Définitif', 'permanent');

                 await logModAction(interaction.guild, {
                    action: 'MUTE PERMANENT',
                    moderator: interaction.user,
                    target: targetMember.user,
                    reason: 'Via Signalement',
                    details: 'Mute définitif',
                    color: 0xFF0000
                });

                await interaction.reply({ content: `✅ **${targetMember.user.tag}** a été rendu muet définitivement.`, ephemeral: true });
            
            } else if (action === 'traite') {
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                
                // Vérifier permission (Tempmute min => Staff ou Haut Staff)
                const STAFF_ROLE = '1471893729060192256';
                if (!interaction.member.roles.cache.has(STAFF_ROLE) && !interaction.member.roles.cache.has(HIGH_STAFF_ROLE) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', ephemeral: true });
                }

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
            }

        } catch (error) {
            console.error('Erreur action rapide signalement:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'application de la sanction.', ephemeral: true });
            }
        }
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
        await interaction.reply({ content: '✅ Signalement marqué comme traité.', ephemeral: true });
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client, snipes);
        
        // Vérifier si un rôle doit être consommé (retiré après usage)
        try {
            const { checkAndConsumeRole } = require('./commands/utils/permHelper');
            await checkAndConsumeRole(interaction.member, command.data.name);
        } catch (e) {
            console.error('Erreur checkAndConsumeRole:', e);
        }
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Erreur lors de l\'exécution de la commande!', ephemeral: true });
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // ══ Anti-Spam / Anti-Raid ══
    // Vérifie AVANT tout le reste (priorité haute)
    const handled = await antispam.handleMessage(message);
    if (handled) return; // Message traité par l'anti-spam, on arrête là

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

    try {
        await command.executeMessage(message, args, client, snipes);
        
        // Vérifier si un rôle doit être consommé (retiré après usage)
        try {
            const { checkAndConsumeRole } = require('./commands/utils/permHelper');
            await checkAndConsumeRole(message.member, commandName);
        } catch (e) {
            console.error('Erreur checkAndConsumeRole:', e);
        }
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

            const embed = {
                color: 0x5865F2,
                title: `📊 Rapport Quotidien - ${guild.name}`,
                thumbnail: { url: guild.iconURL({ dynamic: true }) },
                fields: [
                    { name: '👥 Membres Totaux', value: `${totalMembers}`, inline: true },
                    { name: '🟢 Actuellement en ligne', value: `${onlineMembers}`, inline: true },
                    { name: '🚀 Niveau de Boost', value: `${boostCount} (Niveau ${boostLevel})`, inline: true }
                ],
                footer: { text: 'Stats quotidiennes (9:00)' },
                timestamp: new Date().toISOString()
            };

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