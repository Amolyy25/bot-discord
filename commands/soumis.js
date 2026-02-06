const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { saveUserRoles } = require('./utils/soumisHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soumis')
        .setDescription('Soumet un utilisateur en lui enlevant ses rôles')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('L\'utilisateur à soumettre')
                .setRequired(true)),

    async execute(interaction) {
        const { isPerm3OrAdmin, isModChannel } = require('./utils/permHelper');
        if (!isModChannel(interaction.channelId)) return;
        if (!isPerm3OrAdmin(interaction.member)) {
            return interaction.reply({ content: 'non ta pas la perm', ephemeral: true });
        }
        const target = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ content: 'Utilisateur non trouvé!', ephemeral: true });
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'Vous ne pouvez pas soumettre quelqu\'un avec un rôle égal ou supérieur!', ephemeral: true });
        }

        let role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'soumis');
        if (!role) {
            try {
                role = await interaction.guild.roles.create({
                    name: 'soumis',
                    color: '#010101',
                    permissions: 0n, // Aucune permission
                    reason: 'Rôle pour la commande soumis'
                });
            } catch (error) {
                return interaction.reply({ content: 'Je ne peux pas créer le rôle "soumis"!', ephemeral: true });
            }
        }

        try {
            // Sauvegarder les rôles actuels (filtre les rôles gérés et @everyone)
            const removableRoles = member.roles.cache.filter(r => r.name !== '@everyone' && !r.managed);
            const roleIds = removableRoles.map(r => r.id);
            
            if (roleIds.length > 0) {
                saveUserRoles(interaction.guild.id, target.id, roleIds);
                // Enlever tous les rôles
                await member.roles.remove(removableRoles);
            }

            // Ajouter le rôle soumis
            await member.roles.add(role);
            
            const { logModAction } = require('./utils/logHelper');
            await logModAction(interaction.guild, {
                action: 'SOUMIS',
                moderator: interaction.user,
                target: target,
                color: 0x010101
            });
            
            await interaction.reply({ content: `${target} a été soumis par **${interaction.user.tag}** !` });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Erreur lors de la soumission!', ephemeral: true });
        }
    },

    async executeMessage(message, args) {
        const { isPerm3OrAdmin, isModChannel } = require('./utils/permHelper');
        if (!isModChannel(message.channel.id)) return;
        if (!isPerm3OrAdmin(message.member)) {
            return message.reply('non ta pas la perm');
        }

        const target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('Usage: -soumis @utilisateur ou ID');

        const member = await message.guild.members.fetch(target.id).catch(() => null);
        if (!member) return message.reply('Utilisateur non trouvé!');
        if (member.roles.highest.position >= message.member.roles.highest.position) {
            return message.reply('Vous ne pouvez pas soumettre quelqu\'un avec un rôle égal ou supérieur!');
        }

        let role = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'soumis');
        if (!role) {
            try {
                role = await message.guild.roles.create({
                    name: 'soumis',
                    color: '#010101',
                    permissions: 0n,
                    reason: 'Rôle pour la commande soumis'
                });
            } catch (error) {
                return message.reply('Je ne peux pas créer le rôle "soumis"!');
            }
        }

        try {
            const removableRoles = member.roles.cache.filter(r => r.name !== '@everyone' && !r.managed);
            const roleIds = removableRoles.map(r => r.id);
            
            if (roleIds.length > 0) {
                saveUserRoles(message.guild.id, target.id, roleIds);
                await member.roles.remove(removableRoles);
            }

            await member.roles.add(role);

            const { logModAction } = require('./utils/logHelper');
            await logModAction(message.guild, {
                action: 'SOUMIS',
                moderator: message.author,
                target: target,
                color: 0x010101
            });

            await message.channel.send({ content: `${target} a été soumis par **${message.author.tag}** !` });
        } catch (error) {
            console.error(error);
            message.reply('Erreur lors de la soumission!');
        }
    }
};
