const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Parses color that can be either hex string "0xRRGGBB" or decimal string/number.
 */
function parseColor(color) {
    if (!color) return undefined;
    if (typeof color === 'number') return color;
    if (typeof color === 'string') {
        if (color.startsWith('0x')) {
            return parseInt(color.replace('0x', ''), 16);
        }
        return parseInt(color, 10);
    }
    return undefined;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure le serveur à partir du fichier templates.json')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const { isPerm3OrAdmin, isModChannel } = require('./utils/permHelper');
        if (isModChannel(interaction.channelId)) return;
        if (!isPerm3OrAdmin(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        await interaction.deferReply();

        try {
            const templatePath = path.join(__dirname, '..', 'templates.json');
            if (!fs.existsSync(templatePath)) {
                return interaction.editReply('Le fichier `templates.json` est introuvable.');
            }

            const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
            const guild = interaction.guild;

            // 1. Création des Rôles
            console.log('Début de la création des rôles...');
            if (template.roles && Array.isArray(template.roles)) {
                for (const roleData of template.roles) {
                    if (roleData.name === '@everyone') continue;

                    try {
                        await guild.roles.create({
                            name: roleData.name,
                            color: parseColor(roleData.color),
                            permissions: roleData.permissions ? BigInt(roleData.permissions) : undefined,
                            hoist: roleData.hoist || false,
                            position: roleData.position || undefined,
                            reason: 'Setup template'
                        });
                        console.log(`Rôle créé: ${roleData.name}`);
                    } catch (err) {
                        console.error(`Erreur création rôle ${roleData.name}:`, err);
                    }
                }
            }

            // 2. Création des Salons Textuels et Catégories
            let currentCategory = null;
            console.log('Début de la création des salons...');

            if (template.channels && Array.isArray(template.channels)) {
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
                            parent: (channelData.type !== 4 && currentCategory) ? currentCategory : null,
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
            }

            // 3. Création des Salons Vocaux
            if (template.voice_channels && Array.isArray(template.voice_channels)) {
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
            }

            await interaction.editReply('✅ Le serveur a été configuré avec succès depuis le template !');
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Une erreur est survenue lors de la configuration du serveur.');
        }
    },

    async executeMessage(message, args) {
        const { isPerm3OrAdmin, isModChannel } = require('./utils/permHelper');
        if (isModChannel(message.channel.id)) return;
        if (!isPerm3OrAdmin(message.member)) {
            return message.reply('non ta pas la perm');
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
            if (template.roles && Array.isArray(template.roles)) {
                for (const roleData of template.roles) {
                    if (roleData.name === '@everyone') continue;

                    try {
                        await guild.roles.create({
                            name: roleData.name,
                            color: parseColor(roleData.color),
                            permissions: roleData.permissions ? BigInt(roleData.permissions) : undefined,
                            hoist: roleData.hoist || false,
                            position: roleData.position || undefined,
                            reason: 'Setup template'
                        });
                    } catch (err) {
                        console.error(err);
                    }
                }
            }

            // 2. Création des Salons Textuels et Catégories
            let currentCategory = null;
            if (template.channels && Array.isArray(template.channels)) {
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
                            parent: (channelData.type !== 4 && currentCategory) ? currentCategory : null,
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
            }

            // 3. Création des Salons Vocaux
            if (template.voice_channels && Array.isArray(template.voice_channels)) {
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
            }

            msg.edit('✅ Le serveur a été configuré avec succès depuis le template !');
        } catch (error) {
            console.error(error);
            msg.edit('❌ Une erreur est survenue lors de la configuration du serveur.');
        }
    }
};
