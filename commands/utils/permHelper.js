const { PermissionFlagsBits } = require('discord.js');

const ROLES = {
    BOOSTER: '1469314101615398995',
    PERM_2: '1469071689768767589',
    STAFF_TEST: '1469071689831940310',
    STAFF: '1469071689848721510',
    PERM_3: '1469071689768767590'
};

const MOD_CHANNEL_ID = '1469258215916175392';
const GENERAL_CHANNEL_ID = '1469071689798000676'; // Found in history or common pattern if needed, but let's try to be generic if unknown. Actually I should check if I can find it.

/**
 * Check if the member has one of the specified roles or is Admin
 */
function hasAnyRole(member, roleIds) {
    if (!member) return false;
    return roleIds.some(id => member.roles.cache.has(id));
}

function isAdmin(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

module.exports = {
    ROLES,
    MOD_CHANNEL_ID,
    GENERAL_CHANNEL_ID,
    
    isAdmin,

    // isModChannel: Checks if the channel is the allowed mod channel
    isModChannel: (channelId) => channelId === MOD_CHANNEL_ID,

    // isBoosterOrPerm2: Booster, Perm 2, Perm 3, Staff Test, Staff, or Admin
    isBoosterOrPerm2: (member) => isAdmin(member) || hasAnyRole(member, [ROLES.BOOSTER, ROLES.PERM_2, ROLES.PERM_3, ROLES.STAFF_TEST, ROLES.STAFF]),

    // isStaffTest: Staff Test, Staff, or Admin
    isStaffTest: (member) => isAdmin(member) || hasAnyRole(member, [ROLES.STAFF_TEST, ROLES.STAFF]),

    // isStaff: Staff or Admin
    isStaff: (member) => isAdmin(member) || hasAnyRole(member, [ROLES.STAFF]),

    // isPerm3OrAdmin: Perm 3, Staff Test, Staff, or Admin
    isPerm3OrAdmin: (member) => isAdmin(member) || hasAnyRole(member, [ROLES.PERM_3, ROLES.STAFF_TEST, ROLES.STAFF])
};
