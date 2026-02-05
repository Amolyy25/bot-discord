const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure le serveur à partir du fichier templates.json')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const templatePath = path.join(__dirname, '..', 'templates.json');
            if (!fs.existsSync(templatePath)) {
                return interaction.editReply('Le fichier `templates.json` est introuvable.');
            }

            const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
            const guild = interaction.guild;

            // 1. Création des Rôles
            const roleMap = new Map();
            console.log('Début de la création des rôles...');
            
            for (const roleData of template.roles) {
                if (roleData.name === '@everyone') {
                    roleMap.set('@everyone', guild.roles.everyone.id);
                    continue;
                }

                try {
                    const role = await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color ? parseInt(roleData.color.replace('0x', ''), 16) : undefined,
                        permissions: roleData.permissions ? BigInt(roleData.permissions) : undefined,
                        hoist: roleData.hoist || false,
                        reason: 'Setup template'
                    });
                    roleMap.set(roleData.name, role.id);
                    console.log(`Rôle créé: ${roleData.name}`);
                } catch (err) {
                    console.error(`Erreur création rôle ${roleData.name}:`, err);
                }
            }

            // 2. Création des Salons Textuels et Catégories
            let currentCategory = null;
            console.log('Début de la création des salons...');

            for (const channelData of template.channels) {
                const overwrites = [];
                if (channelData.permission_overwrites) {
                    for (const overwrite of channelData.permission_overwrites) {
                        const targetId = overwrite.id === 'roleid' ? guild.id : overwrite.id;
                        overwrites.push({
                            id: targetId,
                            allow: BigInt(overwrite.allow || 0),
                            deny: BigInt(overwrite.deny || 0)
                        });
                    }
                }

                try {
                    const channel = await guild.channels.create({
                        name: channelData.name.replace('#', ''),
                        type: channelData.type === 4 ? ChannelType.GuildCategory : (channelData.type === 0 ? ChannelType.GuildText : ChannelType.GuildText),
                        topic: channelData.topic || null,
                        position: channelData.position,
                        parent: channelData.type !== 4 ? currentCategory : null,
                        permissionOverwrites: overwrites,
                        reason: 'Setup template'
                    });

                    if (channelData.type === 4) {
                        currentCategory = channel.id;
                        console.log(`Catégorie créée: ${channel.name}`);
                    } else {
                        console.log(`Salon créé: ${channel.name}`);
                    }
                } catch (err) {
                    console.error(`Erreur création salon ${channelData.name}:`, err);
                }
            }

            // 3. Création des Salons Vocaux
            console.log('Début de la création des salons vocaux...');
            const maxBitrate = guild.maximumBitrate;

            for (const voiceData of template.voice_channels) {
                try {
                    const bitrate = voiceData.bitrate > maxBitrate ? maxBitrate : (voiceData.bitrate || 64000);
                    await guild.channels.create({
                        name: voiceData.name,
                        type: ChannelType.GuildVoice,
                        bitrate: bitrate,
                        userLimit: voiceData.user_limit || 0,
                        position: voiceData.position,
                        reason: 'Setup template'
                    });
                    console.log(`Salon vocal créé: ${voiceData.name} (${bitrate} bps)`);
                } catch (err) {
                    console.error(`Erreur création salon vocal ${voiceData.name}:`, err);
                }
            }

            await interaction.editReply('✅ Le serveur a été configuré avec succès depuis le template !');
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Une erreur est survenue lors de la configuration du serveur.');
        }
    },

    async executeMessage(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Vous n\'avez pas la permission d\'utiliser cette commande !');
        }

        const msg = await message.reply('⏳ Initialisation du setup (cela peut prendre un moment)...');

        try {
            const templatePath = path.join(__dirname, '..', 'templates.json');
            if (!fs.existsSync(templatePath)) {
                return msg.edit('Le fichier `templates.json` est introuvable.');
            }

            const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
            const guild = message.guild;

            // 1. Création des Rôles
            for (const roleData of template.roles) {
                if (roleData.name === '@everyone') continue;

                try {
                    await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color ? parseInt(roleData.color.replace('0x', ''), 16) : undefined,
                        permissions: roleData.permissions ? BigInt(roleData.permissions) : undefined,
                        hoist: roleData.hoist || false,
                        reason: 'Setup template'
                    });
                } catch (err) {
                    console.error(err);
                }
            }

            // 2. Création des Salons Textuels et Catégories
            let currentCategory = null;
            for (const channelData of template.channels) {
                const overwrites = [];
                if (channelData.permission_overwrites) {
                    for (const overwrite of channelData.permission_overwrites) {
                        const targetId = overwrite.id === 'roleid' ? guild.id : overwrite.id;
                        overwrites.push({
                            id: targetId,
                            allow: BigInt(overwrite.allow || 0),
                            deny: BigInt(overwrite.deny || 0)
                        });
                    }
                }

                try {
                    const channel = await guild.channels.create({
                        name: channelData.name.replace('#', ''),
                        type: channelData.type === 4 ? ChannelType.GuildCategory : (channelData.type === 0 ? ChannelType.GuildText : ChannelType.GuildText),
                        topic: channelData.topic || null,
                        position: channelData.position,
                        parent: channelData.type !== 4 ? currentCategory : null,
                        permissionOverwrites: overwrites,
                        reason: 'Setup template'
                    });

                    if (channelData.type === 4) {
                        currentCategory = channel.id;
                    }
                } catch (err) {
                    console.error(err);
                }
            }

            // 3. Création des Salons Vocaux
            const maxBitrate = guild.maximumBitrate;
            for (const voiceData of template.voice_channels) {
                try {
                    const bitrate = voiceData.bitrate > maxBitrate ? maxBitrate : (voiceData.bitrate || 64000);
                    await guild.channels.create({
                        name: voiceData.name,
                        type: ChannelType.GuildVoice,
                        bitrate: bitrate,
                        userLimit: voiceData.user_limit || 0,
                        position: voiceData.position,
                        reason: 'Setup template'
                    });
                } catch (err) {
                    console.error(err);
                }
            }

            msg.edit('✅ Le serveur a été configuré avec succès depuis le template !');
        } catch (error) {
            console.error(error);
            msg.edit('❌ Une erreur est survenue lors de la configuration du serveur.');
        }
    }
};
