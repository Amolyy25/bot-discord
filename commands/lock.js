const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { checkPermission, isAdmin, ROLES } = require('./utils/permHelper');
const { requestDoubleValidation } = require('./utils/validationHelper');

const LOCKS_FILE = path.join(__dirname, '../channelLocks.json');

function loadLocks() {
    try {
        if (!fs.existsSync(LOCKS_FILE)) {
            fs.writeFileSync(LOCKS_FILE, JSON.stringify({}));
            return {};
        }
        const data = fs.readFileSync(LOCKS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors du chargement des locks:', error);
        return {};
    }
}

function saveLocks(locks) {
    try {
        fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks, null, 4));
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des locks:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Verrouille un salon ou le serveur entier')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option => 
            option.setName('option')
                .setDescription('Type de verrouillage')
                .addChoices(
                    { name: 'Salon actuel', value: 'local' },
                    { name: 'Serveur entier (Global)', value: 'global' }
                )),

    async execute(interaction) {
        if (!checkPermission(interaction.member, 'lock')) {
            return interaction.reply({ content: '❌ Permission insuffisante.', flags: 64 });
        }

        const option = interaction.options.getString('option') || 'local';
        const locks = loadLocks();

        const lockAction = async () => {
            if (option === 'global') {
                const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
                for (const [id, channel] of channels) {
                    if (locks[id]) continue;
                    const overwrites = channel.permissionOverwrites.cache.map(o => ({
                        id: o.id,
                        type: o.type,
                        allow: o.allow.bitfield.toString(),
                        deny: o.deny.bitfield.toString()
                    }));
                    locks[id] = overwrites;
                    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }).catch(() => {});
                }
                saveLocks(locks);
                await interaction.channel.send('🔒 **Lock Global activé.** Tous les salons textuels sont verrouillés.');
            } else {
                const channel = interaction.channel;
                if (locks[channel.id]) return interaction.reply({ content: 'Déjà verrouillé.', flags: 64 });

                const overwrites = channel.permissionOverwrites.cache.map(o => ({
                    id: o.id,
                    type: o.type,
                    allow: o.allow.bitfield.toString(),
                    deny: o.deny.bitfield.toString()
                }));
                locks[channel.id] = overwrites;
                saveLocks(locks);
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
                await interaction.reply('🔒 Salon verrouillé.');
            }
        };

        if (option === 'global') {
            return requestDoubleValidation(interaction, 'Lock Global', 'Serveur Entier', lockAction);
        }

        await lockAction();
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'lock')) return;

        const isGlobal = args[0]?.toLowerCase() === 'global';
        const locks = loadLocks();

        const lockAction = async () => {
            if (isGlobal) {
                const channels = message.guild.channels.cache.filter(c => c.isTextBased());
                for (const [id, channel] of channels) {
                    if (locks[id]) continue;
                    const overwrites = channel.permissionOverwrites.cache.map(o => ({
                        id: o.id,
                        type: o.type,
                        allow: o.allow.bitfield.toString(),
                        deny: o.deny.bitfield.toString()
                    }));
                    locks[id] = overwrites;
                    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => {});
                }
                saveLocks(locks);
                await message.channel.send('🔒 **Lock Global activé.**');
            } else {
                if (locks[message.channel.id]) return message.reply('Déjà verrouillé.');
                const overwrites = message.channel.permissionOverwrites.cache.map(o => ({
                    id: o.id,
                    type: o.type,
                    allow: o.allow.bitfield.toString(),
                    deny: o.deny.bitfield.toString()
                }));
                locks[message.channel.id] = overwrites;
                saveLocks(locks);
                await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
                await message.reply('🔒 Salon verrouillé.');
            }
        };

        if (isGlobal) {
            const { requestDoubleValidationMsg } = require('./utils/validationHelper');
            return requestDoubleValidationMsg(message, 'Lock Global', 'Serveur Entier', lockAction);
        }

        await lockAction();
    }
};
