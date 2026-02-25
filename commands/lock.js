const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { checkPermission } = require('./utils/permHelper');

const LOCKS_FILE = path.join(__dirname, '../channelLocks.json');

// Fonction pour charger les locks
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

// Fonction pour sauvegarder les locks
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
        .setDescription('Verrouille le salon actuel (plus personne ne peut parler)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ Cette commande ne peut être utilisée que sur un serveur.', flags: 64 });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && !checkPermission(interaction.member, 'lock')) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de verrouiller ce salon.', flags: 64 });
        }

        const channel = interaction.channel;
        const locks = loadLocks();

        if (locks[channel.id]) {
            return interaction.reply({ content: '⚠️ Ce salon est déjà verrouillé.', flags: 64 });
        }

        // Sauvegarder les permissions actuelles
        const overwrites = channel.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield.toString(),
            deny: overwrite.deny.bitfield.toString()
        }));

        locks[channel.id] = overwrites;
        saveLocks(locks);

        try {
            // Appliquer le verrouillage : Deny SendMessages pour @everyone
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                SendMessages: false
            });

            await interaction.reply('🔒 **Salon verrouillé.** Les permissions ont été sauvegardées.');
        } catch (error) {
            console.error(error);
            // En cas d'erreur, on annule la sauvegarde
            delete locks[channel.id];
            saveLocks(locks);
            await interaction.reply({ content: '❌ Erreur lors du verrouillage du salon.', flags: 64 });
        }
    },

    async executeMessage(message, args) {
        if (!message.guild) {
            return message.reply('❌ Cette commande ne peut être utilisée que sur un serveur.');
        }

        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !checkPermission(message.member, 'lock')) {
            return message.reply('❌ Vous n\'avez pas la permission de verrouiller ce salon.');
        }

        const channel = message.channel;
        const locks = loadLocks();

        if (locks[channel.id]) {
            return message.reply('⚠️ Ce salon est déjà verrouillé.');
        }

        const overwrites = channel.permissionOverwrites.cache.map(overwrite => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield.toString(),
            deny: overwrite.deny.bitfield.toString()
        }));

        locks[channel.id] = overwrites;
        saveLocks(locks);

        try {
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SendMessages: false
            });
            await message.reply('🔒 **Salon verrouillé.** Les permissions ont été sauvegardées.');
        } catch (error) {
            console.error(error);
            delete locks[channel.id];
            saveLocks(locks);
            message.reply('❌ Erreur lors du verrouillage du salon.');
        }
    }
};
