const { 
    Client, 
    GatewayIntentBits, 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ChannelType 
} = require('discord.js');
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

client.once('ready', async () => {
    console.log(`🚀 Bot Architect opérationnel en tant que ${client.user.tag}!`);
});

// Global Message Logic
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Command $vouch logic
    const VOUCH_CHANNEL_ID = '1481934204588789790';
    const PREFIX = process.env.PREFIX || '$';

    if (message.content.startsWith(`${PREFIX}vouch`)) {
        if (message.channel.id !== VOUCH_CHANNEL_ID) {
            return message.reply("Cette commande est uniquement utilisable dans le salon des avis clients.").then(msg => {
                setTimeout(() => msg.delete(), 5000);
                setTimeout(() => message.delete(), 5000);
            });
        }

        const args = message.content.slice(PREFIX.length + 5).trim().split(/ +/);
        if (args.length < 2) {
            return message.reply("Utilisation : `$vouch [note/5] [commentaire]` (ex: `$vouch 5 super bot !`)").then(msg => {
                setTimeout(() => msg.delete(), 5000);
            });
        }

        const note = args[0];
        const comment = args.slice(1).join(' ');

        const vouchEmbed = new EmbedBuilder()
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
            .setDescription(`**Note :** ${note}/5\n**Avis :** ${comment}`)
            .setColor('#FFFFFF')
            .setTimestamp();

        await message.channel.send({ embeds: [vouchEmbed] });
        await message.reply("Merci de ta commande ! Ton avis a été enregistré.").then(msg => {
            setTimeout(() => msg.delete(), 5000);
        });
        await message.delete();
        return;
    }

    // Auto-delete in avis-clients (if it's not a vouch command already handled)
    if (message.channel.id === VOUCH_CHANNEL_ID) {
        const staffRolesNames = [
            '👑 CEO / LEAD DEV',
            '⚡ PERM V (CO-GÉRANT)',
            '💻 PERM IV (DÉVELOPPEUR)',
            '🛡️ PERM III (MODÉRATEUR)',
            '👔 PERM II (SUPPORT CLIENT)'
        ];
        
        const isStaff = message.member.roles.cache.some(r => staffRolesNames.includes(r.name));
        if (!isStaff) {
            await message.delete().catch(console.error);
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const guild = interaction.guild;
    const user = interaction.user;

    if (interaction.customId === 'open_ticket') {
        const supportRole = guild.roles.cache.find(r => r.name === '👔 PERM II (SUPPORT CLIENT)');
        
        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                ...(supportRole ? [{ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }] : [])
            ]
        });

        await interaction.reply({ content: `Ton ticket a été créé : ${ticketChannel}`, ephemeral: true });

        const ticketEmbed = new EmbedBuilder()
            .setTitle("Bonjour !")
            .setDescription("Merci de nous avoir contactés. Un membre de notre équipe va prendre en charge ta demande d'ici quelques instants.\n\nEn attendant, n'hésite pas à décrire précisément ton projet ou ton besoin ci-dessous.")
            .setColor('#FFFFFF')
            .setFooter({ text: "Bot Architect • Service Client" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Prendre en charge')
                .setEmoji('🤝')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Fermer le ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );
        
        await ticketChannel.send({ 
            content: `${user} | ${supportRole ? supportRole : "Support Staff"}`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });
    }

    if (interaction.customId === 'claim_ticket') {
        const staffRolesNames = ['👑 CEO / LEAD DEV', '⚡ PERM V (CO-GÉRANT)', '💻 PERM IV (DÉVELOPPEUR)', '🛡️ PERM III (MODÉRATEUR)', '👔 PERM II (SUPPORT CLIENT)'];
        const isStaff = interaction.member.roles.cache.some(r => staffRolesNames.includes(r.name));

        if (!isStaff) return interaction.reply({ content: "Seul le staff peut claim ce ticket.", ephemeral: true });

        const claimedEmbed = new EmbedBuilder()
            .setDescription(`Ce ticket est désormais pris en charge par ${user}.`)
            .setColor('#FFFFFF');
        
        // Update components to disable claim button
        const oldRow = interaction.message.components[0];
        const newRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(oldRow.components[0]).setDisabled(true).setLabel('En cours...'),
            ButtonBuilder.from(oldRow.components[1])
        );

        await interaction.update({ components: [newRow] });
        await interaction.channel.send({ embeds: [claimedEmbed] });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ content: "Fermeture du ticket dans 5 secondes...", ephemeral: false });
        setTimeout(() => {
            interaction.channel.delete().catch(console.error);
        }, 5000);
    }
});

client.login(process.env.TOKEN);
