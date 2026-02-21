const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { checkPermission, isAdmin } = require('./utils/permHelper');

const LOCKS_FILE = path.join(__dirname, '../vchannelLocks.json');

function loadLocks() {
    try {
        if (!fs.existsSync(LOCKS_FILE)) return {};
        return JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf8'));
    } catch (e) { return {}; }
}

function saveLocks(locks) {
    try { fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks, null, 4)); } catch (e) {}
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vunlock')
        .setDescription('Déverrouille ton salon vocal actuel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        if (!checkPermission(interaction.member, 'vunlock') && !isAdmin(interaction.member) && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de déverrouiller ce salon.', ephemeral: true });
        }

        const channel = interaction.member.voice.channel;
        if (!channel) return interaction.reply({ content: '❌ Vous n\'êtes pas dans un salon vocal.', ephemeral: true });

        const locks = loadLocks();
        if (!locks[channel.id]) return interaction.reply({ content: '⚠️ Ce salon vocal n\'est pas verrouillé.', ephemeral: true });

        const savedOverwrites = locks[channel.id];

        try {
            await channel.permissionOverwrites.set(savedOverwrites);
            delete locks[channel.id];
            saveLocks(locks);
            await interaction.reply(`🔓 **${channel.name}** a été déverrouillé (vocal).`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Erreur.', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'vunlock') && !isAdmin(message.member) && !message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ Vous n\'avez pas la permission.');
        }

        const channel = message.member.voice.channel;
        if (!channel) return message.reply('❌ Vous n\'êtes pas dans un salon vocal.');

        const locks = loadLocks();
        if (!locks[channel.id]) return message.reply('⚠️ Ce salon vocal n\'est pas verrouillé.');

        const savedOverwrites = locks[channel.id];

        try {
            await channel.permissionOverwrites.set(savedOverwrites);
            delete locks[channel.id];
            saveLocks(locks);
            await message.reply(`🔓 **${channel.name}** a été déverrouillé (vocal).`);
        } catch (error) {
            console.error(error);
            message.reply('❌ Erreur.');
        }
    }
};
