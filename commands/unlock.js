const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { checkPermission } = require('./utils/permHelper');

const LOCKS_FILE = path.join(__dirname, '../channelLocks.json');

function loadLocks() {
    try {
        if (!fs.existsSync(LOCKS_FILE)) {
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
        .setName('unlock')
        .setDescription('Déverrouille le salon et rétablit les permissions précédentes')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ Cette commande ne peut être utilisée que sur un serveur.', ephemeral: true });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && !checkPermission(interaction.member, 'unlock')) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de déverrouiller ce salon.', ephemeral: true });
        }

        const channel = interaction.channel;
        const locks = loadLocks();

        if (!locks[channel.id]) {
            return interaction.reply({ content: '⚠️ Ce salon n\'est pas verrouillé (ou aucune sauvegarde trouvée).', ephemeral: true });
        }

        const savedOverwrites = locks[channel.id];

        try {
            // Restaurer les permissions
            // setOverwrites remplace tout, c'est ce qu'on veut pour revenir à l'état exact "d'avant"
            await channel.permissionOverwrites.set(savedOverwrites);

            // Supprimer la sauvegarde
            delete locks[channel.id];
            saveLocks(locks);

            await interaction.reply('🔓 **Salon déverrouillé.** Les permissions ont été restaurées.');
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Erreur lors du déverrouillage du salon.', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        if (!message.guild) {
            return message.reply('❌ Cette commande ne peut être utilisée que sur un serveur.');
        }

        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !checkPermission(message.member, 'unlock')) {
            return message.reply('❌ Vous n\'avez pas la permission de déverrouiller ce salon.');
        }

        const channel = message.channel;
        const locks = loadLocks();

        if (!locks[channel.id]) {
            return message.reply('⚠️ Ce salon n\'est pas verrouillé (ou aucune sauvegarde trouvée).');
        }

        const savedOverwrites = locks[channel.id];

        try {
            await channel.permissionOverwrites.set(savedOverwrites);

            delete locks[channel.id];
            saveLocks(locks);

            await message.reply('🔓 **Salon déverrouillé.** Les permissions ont été restaurées.');
        } catch (error) {
            console.error(error);
            message.reply('❌ Erreur lors du déverrouillage du salon.');
        }
    }
};
