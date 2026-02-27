const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { saveUserRoles } = require('./utils/soumisHelper');
const { addSanction } = require('./utils/sanctionsHelper');

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
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        
        // Vérification de permission
        if (!checkPermission(interaction.member, 'soumis')) {
            return interaction.reply({ content: 'non ta pas la perm', flags: 64 });
        }

        const adminStatus = isAdmin(interaction.member);
        const isGeneral = interaction.channel.name.toLowerCase().includes('general');
        if (!isModChannel(interaction.channelId) && !isGeneral && !adminStatus) return;
        const target = interaction.options.getUser('utilisateur');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) return interaction.reply({ content: 'Utilisateur non trouvé!', flags: 64 });
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: 'Vous ne pouvez pas soumettre quelqu\'un avec un rôle égal ou supérieur!', flags: 64 });
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
                return interaction.reply({ content: 'Je ne peux pas créer le rôle "soumis"!', flags: 64 });
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
            
            // Enregistrer la sanction
            await addSanction(interaction.guild.id, target.id, 'soumis', '1', interaction.user.tag, 'Utilisation de la commande soumis', 'Soumis', 'Soumission');

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
            await interaction.reply({ content: 'Erreur lors de la soumission!', flags: 64 });
        }
    },

    async executeMessage(message, args) {
        const { checkPermission, isModChannel, isAdmin } = require('./utils/permHelper');
        
        // Vérification de permission
        if (!checkPermission(message.member, 'soumis')) {
            return message.reply('non ta pas la perm');
        }

        const adminStatus = isAdmin(message.member);
        const isGeneral = message.channel.name.toLowerCase().includes('general');
        if (!isModChannel(message.channel.id) && !isGeneral && !adminStatus) return;

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

            // Enregistrer la sanction
            await addSanction(message.guild.id, target.id, 'soumis', '1', message.author.tag, 'Utilisation de la commande soumis', 'Soumis', 'Soumission');

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
