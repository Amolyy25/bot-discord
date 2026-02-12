const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Fichier JSON pour stocker les permissions dynamiques
const PERMISSIONS_FILE = path.join(__dirname, '../../permissions.json');
// Fichier JSON pour stocker l'utilisation des commandes (compteurs)
const USAGE_FILE = path.join(__dirname, '../../commandUsage.json');

// --- Gestion des Permissions Dynamiques ---

/**
 * Charge les permissions depuis le fichier JSON
 */
function loadPermissions() {
    try {
        if (!fs.existsSync(PERMISSIONS_FILE)) {
            fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify({}));
            return {};
        }
        const data = fs.readFileSync(PERMISSIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors du chargement des permissions:', error);
        return {};
    }
}

/**
 * Charge les données d'utilisation depuis le fichier JSON
 */
function loadUsageData() {
    try {
        if (!fs.existsSync(USAGE_FILE)) {
            fs.writeFileSync(USAGE_FILE, JSON.stringify({}));
            return {};
        }
        const data = fs.readFileSync(USAGE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors du chargement des usages:', error);
        return {};
    }
}

/**
 * Sauvegarde les permissions dans le fichier JSON
 */
function savePermissions(perms) {
    try {
        fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(perms, null, 4));
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des permissions:', error);
    }
}

/**
 * Sauvegarde les données d'utilisation dans le fichier JSON
 */
function saveUsageData(data) {
    try {
        fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des usages:', error);
    }
}

/**
 * Ajoute une permission à un utilisateur ou un rôle pour une commande donnée
 * @param {string} commandName Nom de la commande (ex: 'ban')
 * @param {string} type 'user' ou 'role'
 * @param {string} id ID de l'utilisateur ou du rôle
 * @param {number} [limit] (Optionnel) Limite d'utilisation pour le rôle avant qu'il ne soit retiré
 */
function addPermission(commandName, type, id, limit) {
    const perms = loadPermissions();
    if (!perms[commandName]) perms[commandName] = { users: [], roles: [], roleLimits: {} };
    
    if (type === 'user' && !perms[commandName].users.includes(id)) {
        perms[commandName].users.push(id);
    } else if (type === 'role') {
        if (!perms[commandName].roles.includes(id)) {
            perms[commandName].roles.push(id);
        }
        // Si une limite est définie, on l'ajoute/met à jour
        if (limit && limit > 0) {
            if (!perms[commandName].roleLimits) perms[commandName].roleLimits = {};
            perms[commandName].roleLimits[id] = limit;
        } else {
            // Si pas de limite, on retire une éventuelle limite existante
            if (perms[commandName].roleLimits && perms[commandName].roleLimits[id]) {
                delete perms[commandName].roleLimits[id];
            }
        }
    }
    
    savePermissions(perms);
}

/**
 * Retire une permission à un utilisateur ou un rôle pour une commande donnée
 * @param {string} commandName Nom de la commande (ex: 'ban')
 * @param {string} type 'user' ou 'role'
 * @param {string} id ID de l'utilisateur ou du rôle
 */
function removePermission(commandName, type, id) {
    const perms = loadPermissions();
    if (!perms[commandName]) return;

    if (type === 'user') {
        perms[commandName].users = perms[commandName].users.filter(uid => uid !== id);
    } else if (type === 'role') {
        perms[commandName].roles = perms[commandName].roles.filter(rid => rid !== id);
        // Nettoyer aussi les limites
        if (perms[commandName].roleLimits && perms[commandName].roleLimits[id]) {
            delete perms[commandName].roleLimits[id];
        }
    }

    savePermissions(perms);
}

/**
 * Vérifie et consomme l'utilisation d'un rôle si nécessaire.
 * Appelé APRÈS l'exécution réussie d'une commande.
 * Implémente une logique robuste "One Strike, All Out" pour les rôles multiples.
 * @param {import('discord.js').GuildMember} member 
 * @param {string} commandName 
 */
async function checkAndConsumeRole(member, commandName) {
    const perms = loadPermissions();
    if (!perms[commandName] || !perms[commandName].roleLimits) return;

    const roleLimits = perms[commandName].roleLimits;
    const usageData = loadUsageData();

    // Identifier tous les rôles limités que possède l'utilisateur
    const userRolesWithLimits = [];
    for (const roleId of Object.keys(roleLimits)) {
        if (member.roles.cache.has(roleId)) {
            userRolesWithLimits.push(roleId);
        }
    }

    if (userRolesWithLimits.length === 0) return;

    const rolesToRemove = new Set();
    let shouldTriggerMassRemoval = false;

    // 1. Mise à jour des compteurs et détection des dépassements
    for (const roleId of userRolesWithLimits) {
        const limit = roleLimits[roleId];
        const usageKey = `${member.id}-${commandName}-${roleId}`; // Clé unique par user+commande+rôle

        if (!usageData[usageKey]) usageData[usageKey] = 0;
        usageData[usageKey]++;
        
        console.log(`[PermHelper] Commande ${commandName} utilisée par ${member.user.tag} (Rôle ${roleId}). Usage: ${usageData[usageKey]}/${limit}`);

        if (usageData[usageKey] >= limit) {
            shouldTriggerMassRemoval = true; // Un rôle a atteint sa limite -> on déclenche le nettoyage
        }
    }

    // 2. Logique "Infallible" : Si un rôle doit sauter, tous les autres rôles donnant accès à cette commande sautent aussi
    // Cela empêche le cumul de rôles pour contourner les limites.
    if (shouldTriggerMassRemoval) {
        for (const roleId of userRolesWithLimits) {
            rolesToRemove.add(roleId);
        }
    }

    // 3. Exécution des suppressions
    for (const roleId of rolesToRemove) {
        try {
            await member.roles.remove(roleId);
            console.log(`[PermHelper] Limite atteinte (ou effet cascade). Rôle ${roleId} retiré de ${member.user.tag}.`);
            
            // Reset le compteur une fois le rôle retiré (pour permettre la réutilisation future si le rôle est rendu)
            const usageKey = `${member.id}-${commandName}-${roleId}`;
            delete usageData[usageKey];
            
        } catch (error) {
            console.error(`[PermHelper] Erreur lors du retrait du rôle ${roleId} :`, error);
        }
    }
    
    saveUsageData(usageData);
}

/**
 * Vérifie si un membre a la permission d'exécuter une commande spécifique via les permissions dynamiques
 * @param {import('discord.js').GuildMember} member 
 * @param {string} commandName 
 */
function hasDynamicPermission(member, commandName) {
    const perms = loadPermissions();
    if (!perms[commandName]) return false;

    // Vérifier l'utilisateur spécifique
    if (perms[commandName].users && perms[commandName].users.includes(member.id)) return true;

    // Vérifier les rôles
    if (perms[commandName].roles && member.roles.cache.some(role => perms[commandName].roles.includes(role.id))) return true;

    return false;
}

// --- Logique Existante ---

const ROLES = {
    BOOSTER: '1469314101615398995',
    PERM_2: '1469071689768767589',
    STAFF_TEST: '1469071689831940310',
    STAFF: '1469071689848721510',
    PERM_3: '1469071689768767590'
};

const MOD_CHANNEL_ID = '1469258215916175392';
const GENERAL_CHANNEL_ID = '1469071689798000676';

function hasAnyRole(member, roleIds) {
    if (!member) return false;
    // Si roleIds est un tableau de tableaux (pour compatibilité ancienne), on aplatit
    const ids = roleIds.flat(); 
    return ids.some(id => member.roles.cache.has(id));
}

function isAdmin(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Vérifie globalement si un utilisateur peut exécuter une commande
 * @param {import('discord.js').GuildMember} member 
 * @param {string} commandName Nom de la commande
 * @param {Function} defaultCheck Fonction de vérification par défaut (ancienne logique)
 */
function checkPermission(member, commandName, defaultCheck) {
    // 1. Admin a toujours accès
    if (isAdmin(member)) return true;

    // 2. Vérification dynamique (ajoutée via /addperm)
    if (hasDynamicPermission(member, commandName)) return true;

    // 3. Fallback sur la logique codée en dur si fournie
    if (defaultCheck && typeof defaultCheck === 'function') {
        return defaultCheck(member);
    }

    return false;
}

module.exports = {
    ROLES,
    MOD_CHANNEL_ID,
    GENERAL_CHANNEL_ID,
    
    isAdmin,
    hasAnyRole,
    
    // Nouvelles fonctions exportées
    addPermission,
    removePermission,
    checkPermission,
    checkAndConsumeRole,

    // Wrappers rétro-compatibles (mais idéalement on migrera vers checkPermission)
    isModChannel: (channelId) => channelId === MOD_CHANNEL_ID,

    isBoosterOrPerm2: (member) => checkPermission(member, 'booster_perm2', (m) => hasAnyRole(m, [ROLES.BOOSTER, ROLES.PERM_2, ROLES.PERM_3, ROLES.STAFF_TEST, ROLES.STAFF])),

    isStaffTest: (member) => checkPermission(member, 'staff_test', (m) => hasAnyRole(m, [ROLES.STAFF_TEST, ROLES.STAFF])),

    isStaff: (member) => checkPermission(member, 'staff', (m) => hasAnyRole(m, [ROLES.STAFF])),

    isPerm3OrAdmin: (member) => checkPermission(member, 'perm3_admin', (m) => hasAnyRole(m, [ROLES.PERM_3, ROLES.STAFF_TEST, ROLES.STAFF]))
};
