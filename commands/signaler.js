const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signaler')
        .setDescription('Signaler un utilisateur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('La personne à signaler')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('La raison du signalement')
                .setRequired(true)),

    async execute(interaction) {
        return interaction.reply({ content: 'Cette commande est optimisée pour être utilisée avec le préfixe -signaler', flags: 64 });
    },

    async executeMessage(message, args, client) {
        const reportChannelId = '1471884911056130254';

        // 1. Identifier la cible et la raison
        let targetUser;
        let reason;
        let referencedMessage = null;

        // Cas 1: Réponse à un message
        if (message.reference && message.reference.messageId) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                targetUser = repliedMessage.author;
                reason = args.join(' ');
                referencedMessage = repliedMessage;
            } catch (error) {
                console.error('Erreur lors de la récupération du message répondu:', error);
            }
        } 
        // Cas 2: Mention ou ID
        else {
            if (args[0]) {
                const mentionMatch = args[0].match(/^<@!?(\d+)>$/);
                const targetId = mentionMatch ? mentionMatch[1] : args[0];
                try {
                    targetUser = await client.users.fetch(targetId);
                } catch (e) {
                    targetUser = null;
                }
                reason = args.slice(1).join(' ');
            }
        }

        // 2. Validations
        if (!targetUser) {
            return message.reply(`Il vous manque la raison ou l'utilisateur, la commande est \`-signaler <id/mention> <raison>\` ou répondre à un message avec \`-signaler <raison>\``);
        }

        if (targetUser.id === message.author.id) {
            return message.reply('Vous ne pouvez pas vous signaler vous-même !');
        }

        if (targetUser.bot) {
            return message.reply('Vous ne pouvez pas signaler un bot (sauf si c\'est moi qui bug, dans ce cas mp mon créateur !)');
        }

        if (!reason || reason.trim() === '') {
            return message.reply(`Il vous manque la raison, la personne à signaler est ${targetUser.tag} (${targetUser.id})`);
        }

        // 3. Récupérer le membre pour la date d'arrivée
        let targetMember = null;
        try {
            targetMember = await message.guild.members.fetch(targetUser.id);
        } catch (e) {
            // L'utilisateur n'est peut-être plus sur le serveur
        }

        // 4. Créer l'embed de signalement
        const joinedAt = targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : 'Inconnu';
        
        const reportEmbed = new EmbedBuilder()
            .setColor(0xFFFFFF)
            .setTitle('Nouveau Signalement')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Signalé', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                { name: 'Signaleur', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
                { name: 'Salon', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Arrivée serveur', value: joinedAt, inline: true },
                { name: 'Raison', value: reason }
            )
            .setTimestamp();

        if (referencedMessage && referencedMessage.content) {
            reportEmbed.addFields({ 
                name: 'Contenu du message signalé', 
                value: referencedMessage.content.length > 1024 ? referencedMessage.content.substring(0, 1021) + '...' : referencedMessage.content 
            });
        }
        
        // Ajout des pièces jointes si preuves
        if (referencedMessage && referencedMessage.attachments.size > 0) {
            const attachmentUrl = referencedMessage.attachments.first().url;
            reportEmbed.setImage(attachmentUrl);
        } else if (message.attachments.size > 0) {
             const attachmentUrl = message.attachments.first().url;
             reportEmbed.setImage(attachmentUrl);
        }


        // 5. Créer les boutons d'action rapide
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`signaler_tempmute_10m_${targetUser.id}`)
                    .setLabel('Tempmute 10m')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`signaler_tempmute_15m_${targetUser.id}`)
                    .setLabel('Tempmute 15m')
                    .setStyle(ButtonStyle.Secondary),
                 new ButtonBuilder()
                    .setCustomId(`signaler_tempmute_30m_${targetUser.id}`)
                    .setLabel('Tempmute 30m')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`signaler_ban_${targetUser.id}`)
                    .setLabel('Ban')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`signaler_mute_${targetUser.id}`)
                    .setLabel('Mute Def')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`signaler_traite_${targetUser.id}`)
                    .setLabel('Marquer comme traité')
                    .setStyle(ButtonStyle.Success)
            );

        // 6. Envoyer le log
        try {
            const reportChannel = await client.channels.fetch(reportChannelId);
            if (reportChannel) {
                await reportChannel.send({ embeds: [reportEmbed], components: [row1, row2] });
            } else {
                console.error(`Salon de signalement introuvable: ${reportChannelId}`);
                return message.reply('Erreur interne : salon de logs introuvable.');
            }
        } catch (error) {
            console.error('Erreur lors de l\'envoi du log:', error);
            return message.reply('Erreur lors de l\'envoi du signalement.');
        }

        // 7. Confirmation DM et Message
        try {
            await message.author.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('Signalement reçu')
                        .setDescription(`Votre signalement contre **${targetUser.tag}** a bien été pris en compte et transmis à l'équipe de modération.\n\nMerci de votre vigilance !`)
                        .setTimestamp()
                ]
            });
        } catch (e) {
            // MP bloqués, tant pis
        }

        // Confirmation rapide dans le channel (autodelete ?)
        message.reply('✅ Signalement envoyé aux modérateurs.').then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        });
        
        // Supprimer le message de commande pour la propreté
        message.delete().catch(() => {});
    }
};
