const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const http = require('http');
const cron = require('node-cron');
const statsCommand = require('./commands/stats.js');
const antispam = require('./commands/utils/antispamHelper');

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
        GatewayIntentBits.GuildInvites
    ]
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
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client, snipes);
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

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    // Initialiser l'anti-spam
    antispam.init(client);

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