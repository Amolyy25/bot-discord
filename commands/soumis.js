const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const trust = require('./utils/trustHelper');
const { checkPermission, isModChannel, isAdmin, getStaffLevel } = require('./utils/permHelper');
const { requestDoubleValidation } = require('./utils/validationHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soumis')
        .setDescription('Neutralise un membre (Timeout 24h + Retrait rôles)')
        .addUserOption(option => option.setName('cible').setDescription('Le membre à soumettre').setRequired(true))
        .addIntegerOption(option => option.setName('duree').setDescription('Durée en heures (Défaut 24h)')),

    async execute(interaction) {
        const hasPerm = checkPermission(interaction.member, 'soumis');
        if (!hasPerm) return interaction.reply({ content: '❌ Vous n\'avez pas la permission.', flags: 64 });

        const target = interaction.options.getMember('cible');
        const duration = interaction.options.getInteger('duree') || 24;

        if (!target) return interaction.reply({ content: 'Membre introuvable.', flags: 64 });
        
        // Empêcher de se soumettre soi-même ou qqun de plus haut
        if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Impossible.', flags: 64 });
        if (target.roles.highest.position >= interaction.member.roles.highest.position && !isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ Hiérarchie insuffisante.', flags: 64 });
        }

        const executeAction = async () => {
            await trust.applySoumis(target, duration, `Manuel par ${interaction.user.tag}`);
            // Pas de reply ici s'il est déjà fait par la validation, ou alors interaction.followUp
            if (!interaction.replied) {
                await interaction.reply({ content: `✅ ${target} a été soumis pour ${duration}h.` });
            }
        };

        // Double validation si la cible est un staff (Niveaux Perm I+)
        const targetStaffLevel = getStaffLevel(target);
        if (targetStaffLevel > 0) {
            return requestDoubleValidation(interaction, 'Soumission Staff', target.user.tag, executeAction);
        }

        await executeAction();
    },

    async executeMessage(message, args) {
        if (!checkPermission(message.member, 'soumis')) return;

        const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
        if (!target) return message.reply('❌ Usage: `-soumis @membre`');

        if (target.roles.highest.position >= message.member.roles.highest.position && !isAdmin(message.member)) {
            return message.reply('❌ Hiérarchie insuffisante.');
        }

        const executeAction = async () => {
            await trust.applySoumis(target, 24, `Manuel (Message) par ${message.author.tag}`);
            await message.channel.send(`${target} est maintenant la soumise de ${message.author.tag} !`);
        };

        if (getStaffLevel(target) > 0) {
            const { requestDoubleValidationMsg } = require('./utils/validationHelper');
            return requestDoubleValidationMsg(message, 'Soumission Staff', target.user.tag, executeAction);
        }

        await executeAction();
    }
};
