const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Fichier JSON pour stocker les permissions dynamiques
const PERMISSIONS_FILE = path.join(__dirname, '../../ajout-permissions.json');
// Fichier JSON pour stocker l'utilisation des commandes (compteurs)
const USAGE_FILE = path.join(__dirname, '../../commandUsage.json');

// --- Gestion des Permissions Dynamiques ---

/**
 * Charge les permissions depuis le fichier JSON
 */
function loadPermissions() {
    try {
        if (!fs.existsSync(PERMISSIONS_FILE)) {
            console.log('[PermHelper] Fichier permissions.json inexistant, création d\'un nouveau.');
            fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify({}));
            return {};
        }
        const data = fs.readFileSync(PERMISSIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[PermHelper] CRITICAL: Erreur lors du chargement des permissions:', error);
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
        console.error('[PermHelper] Erreur lors du chargement des usages:', error);
        return {};
    }
}

/**
 * Sauvegarde les permissions dans le fichier JSON de manière atomique
 */
function savePermissions(perms) {
    try {
        const tempFile = `${PERMISSIONS_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(perms, null, 4));
        fs.renameSync(tempFile, PERMISSIONS_FILE);
        console.log('[PermHelper] Permissions sauvegardées avec succès.');
    } catch (error) {
        console.error('[PermHelper] CRITICAL: Erreur lors de la sauvegarde des permissions:', error);
    }
}

/**
 * Sauvegarde les données d'utilisation dans le fichier JSON
 */
function saveUsageData(data) {
    try {
        fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('[PermHelper] Erreur lors de la sauvegarde des usages:', error);
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
    console.log(`[PermHelper] Tentative d'ajout de permission: Commande="${commandName}", Type="${type}", ID="${id}", Limit="${limit}"`);
    const perms = loadPermissions();
    if (!perms[commandName]) perms[commandName] = { users: [], roles: [], roleLimits: {} };
    
    if (type === 'user' && !perms[commandName].users.includes(id)) {
        perms[commandName].users.push(id);
        console.log(`[PermHelper] Permission utilisateur ajoutée.`);
    } else if (type === 'role') {
        if (!perms[commandName].roles.includes(id)) {
            perms[commandName].roles.push(id);
            console.log(`[PermHelper] Permission rôle ajoutée.`);
        }
        // Si une limite est définie, on l'ajoute/met à jour
        if (limit && limit > 0) {
            if (!perms[commandName].roleLimits) perms[commandName].roleLimits = {};
            perms[commandName].roleLimits[id] = limit;
            console.log(`[PermHelper] Limite de rôle définie: ${limit}`);
        } else {
            // Si pas de limite, on retire une éventuelle limite existante
            if (perms[commandName].roleLimits && perms[commandName].roleLimits[id]) {
                delete perms[commandName].roleLimits[id];
                console.log(`[PermHelper] Limite de rôle supprimée.`);
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
    console.log(`[PermHelper] Tentative de retrait de permission: Commande="${commandName}", Type="${type}", ID="${id}"`);
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
    PERM_1: '1469071689756442805',
    PERM_2: '1469071689768767589',
    PERM_3: '1469071689768767590',
    PERM_4: '1469071689768767591',
    PERM_5: '1476184863404200061',
    SOUVERAIN: '1475894024866107504',
    BOOSTER: '1469314101615398995',
    SOUMIS: 'soumis' // Nom du rôle ou ID si fixe
};

const MOD_CHANNEL_ID = '1469258215916175392';
const ADMIN_PING_ID = '1475891404566954128';

// Mapping des commandes par niveau de permission
const COMMAND_PERMS = {
    // Perm I
    'warn': ROLES.PERM_1,
    'userinfo': ROLES.PERM_1,
    'pic': ROLES.PERM_1,
    'banner': ROLES.PERM_1,
    'immune_spam': ROLES.PERM_1,
    'immune_antiraid': ROLES.PERM_1,

    // Perm II
    'tempmute': ROLES.PERM_2,
    'unmute': ROLES.PERM_2,
    'vmute': ROLES.PERM_2,
    'vunmute': ROLES.PERM_2,

    // Perm III
    'sanctions': ROLES.PERM_3,
    'vkick': ROLES.PERM_3,
    'snipe': ROLES.PERM_3,
    'fake': ROLES.PERM_3,
    'vmoveall': ROLES.PERM_3,
    'vgather': ROLES.PERM_3,
    'score': ROLES.PERM_3,

    // Perm IV
    'mute': ROLES.PERM_4,
    'vlock': ROLES.PERM_4,
    'vunlock': ROLES.PERM_4,
    'kick': ROLES.PERM_4,

    // Perm V
    'lock': ROLES.PERM_5,
    'vclear': ROLES.PERM_5,
    'soumis': ROLES.PERM_5,
    'bl': ROLES.PERM_5,
    'setscore': ROLES.PERM_5,
    'shadowmute': ROLES.PERM_5,
    'unsoumis': ROLES.PERM_5,

    // Spécial
    'rankup': ROLES.SOUVERAIN
};

// Quotas de modération (utilisations par heure/fenêtre)
const COMMAND_QUOTAS = {
    'unmute': { limit: 10, window: 3600000 },
    'tempmute': { limit: 10, window: 3600000 },
    'mute': { limit: 2, window: 3600000 },
    'kick': { limit: 3, window: 60000 }, // Anti-Nuke: 3 kicks / 1 min
    'lock': { limit: 2, window: 3600000 },
    'soumis': { limit: 2, window: 3600000 },
    'rankup': { limit: 1, window: 7 * 24 * 60 * 60 * 1000 }
};

// Suivi des quotas en mémoire (clé: userId-commandName)
const quotaTracker = new Map();

/**
 * Vérifie si une commande respecte son quota horaire
 */
function checkQuota(userId, commandName) {
    const quota = COMMAND_QUOTAS[commandName];
    if (!quota) return true;

    const key = `${userId}-${commandName}`;
    const now = Date.now();
    let usages = quotaTracker.get(key) || [];

    // Nettoyer les vieux usages
    usages = usages.filter(t => now - t < quota.window);

    if (usages.length >= quota.limit) return false;

    usages.push(now);
    quotaTracker.set(key, usages);
    return true;
}

/**
 * Vérifie si un membre a le rôle requis (hiérarchie cumulative)
 */
function hasPermLevel(member, requiredRoleId) {
    if (!member) return false;
    if (isAdmin(member)) return true;

    const memberRoles = member.roles.cache;
    
    // Hiérarchie cumulative : Perm V > IV > III > II > I
    const hierarchy = [
        ROLES.PERM_1,
        ROLES.PERM_2,
        ROLES.PERM_3,
        ROLES.PERM_4,
        ROLES.PERM_5
    ];

    const requiredIndex = hierarchy.indexOf(requiredRoleId);
    
    // Si c'est un rôle de la hiérarchie standard
    if (requiredIndex !== -1) {
        // Le membre a-t-il un rôle de niveau égal ou supérieur ?
        for (let i = requiredIndex; i < hierarchy.length; i++) {
            if (memberRoles.has(hierarchy[i])) return true;
        }
    }

    // Cas spécial SOUVERAIN (accès Perm II et III)
    if (memberRoles.has(ROLES.SOUVERAIN)) {
        if (requiredRoleId === ROLES.SOUVERAIN) return true;
        if (requiredRoleId === ROLES.PERM_1 || requiredRoleId === ROLES.PERM_2 || requiredRoleId === ROLES.PERM_3) return true;
    }

    // Cas direct (si ce n'est pas dans la hiérarchie cumulative, ex: BOOSTER)
    if (memberRoles.has(requiredRoleId)) return true;

    return false;
}

function hasAnyRole(member, roleIds) {
    if (!member) return false;
    const ids = Array.isArray(roleIds) ? roleIds.flat() : [roleIds];
    return ids.some(id => member.roles.cache.has(id));
}

function isAdmin(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.id === member.guild.ownerId;
}

/**
 * Vérifie globalement si un utilisateur peut exécuter une commande
 */
function checkPermission(member, commandName) {
    if (isAdmin(member)) return true;

    // 1. Vérification du quota
    if (!checkQuota(member.id, commandName)) {
        console.log(`[PermHelper] Quota atteint pour ${member.user.tag} sur ${commandName}`);
        return 'quota_reached';
    }

    // 2. Vérification Hiérarchie Fixe
    const requiredRole = COMMAND_PERMS[commandName];
    if (requiredRole && hasPermLevel(member, requiredRole)) return true;

    // 3. Vérification Dynamique (ajoutée via /addperm)
    if (hasDynamicPermission(member, commandName)) return true;

    return false;
}

function getStaffLevel(member) {
    if (member.roles.cache.has(ROLES.SOUVERAIN)) return 6;
    if (member.roles.cache.has(ROLES.PERM_5)) return 5;
    if (member.roles.cache.has(ROLES.PERM_4)) return 4;
    if (member.roles.cache.has(ROLES.PERM_3)) return 3;
    if (member.roles.cache.has(ROLES.PERM_2)) return 2;
    if (member.roles.cache.has(ROLES.PERM_1)) return 1;
    return 0;
}

module.exports = {
    ROLES,
    MOD_CHANNEL_ID,
    ADMIN_PING_ID,
    
    isAdmin,
    hasAnyRole,
    hasPermLevel,
    getStaffLevel,
    
    addPermission,
    removePermission,
    checkPermission,
    checkAndConsumeRole,
    loadPermissions,

    isModChannel: (channelId) => channelId === MOD_CHANNEL_ID,
    isBoosterOrPerm2: (member) => member.roles.cache.has(ROLES.BOOSTER) || hasPermLevel(member, ROLES.PERM_2),
    COMMAND_PERMS,
    COMMAND_QUOTAS
};
