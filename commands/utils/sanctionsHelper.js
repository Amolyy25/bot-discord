const fs = require('fs');
const path = require('path');

const sanctionsPath = path.join(__dirname, '../../sanctions.json');

const INFRACTION_CONFIG = {
    'Spam': {
        '1': { label: 'Flood léger', duration: '5m' },
        '2': { label: 'Spam intensif', duration: '30m' },
        '3': { label: 'Spam malveillant/Liens', duration: '2h' }
    },
    'Troll': {
        '1': { label: 'Comportement agaçant', duration: '10m' },
        '2': { label: 'Provocations répétés', duration: '1h' },
        '3': { label: 'Troll destructeur / Raid', duration: '6h' }
    },
    'Mentions': {
        '1': { label: 'Mentions abusives (< 5)', duration: '10m' },
        '2': { label: 'Mentions abusives (5 - 10)', duration: '1h' },
        '3': { label: 'Mass Mentions (> 10)', duration: '1d' }
    },
    'Insulte': {
        '1': { label: 'Langage familier', duration: '10m' },
        '2': { label: 'Insulte directe', duration: '20m' },
        '3': { label: 'Insulte grave / Harcèlement', duration: '1h' }
    },
    'Propos déplacés': {
        '1': { label: 'Propos choquant', duration: '15m' },
        '2': { label: 'Propos dérangeant', duration: '20m' },
        '3': { label: 'Propos à caractère sexuelle, mysogine etc', duration: '30m' }
    },
    'Autre': {
        '1': { label: 'Infraction mineure', duration: '5m' },
        '2': { label: 'Infraction notable', duration: '30m' },
        '3': { label: 'Infraction majeure', duration: '4h' }
    }
};

// Sanctions prédéfinies (fallback ou autres types)
const PREDEFINED_SANCTIONS = {
    tempmute: { '1': { duration: '10m' } },
    mute: { '1': { duration: 'permanent' } },
    kick: { '1': { duration: 'instantané' } },
    ban: { '1': { duration: 'permanent' } },
    warn: { '1': { duration: 'instantané' } }
};

function parseDuration(durationStr) {
    if (!durationStr) return null;
    const units = {
        's': 1000,
        'm': 60000,
        'h': 3600000,
        'd': 86400000,
        'w': 604800000
    };
    const match = durationStr.match(/^(\d+)([smhdw])$/i);
    if (!match) return null;
    return parseInt(match[1]) * units[match[2].toLowerCase()];
}

function loadSanctions() {
    if (fs.existsSync(sanctionsPath)) {
        try {
            return JSON.parse(fs.readFileSync(sanctionsPath, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveSanctions(sanctions) {
    fs.writeFileSync(sanctionsPath, JSON.stringify(sanctions, null, 2));
}

function addSanction(guildId, userId, type, level, moderator, reason, category, gravityLabel, customDuration = null) {
    const sanctions = loadSanctions();
    
    if (!sanctions[guildId]) sanctions[guildId] = {};
    if (!sanctions[guildId][userId]) sanctions[guildId][userId] = [];

    const duration = customDuration || (INFRACTION_CONFIG[category] && INFRACTION_CONFIG[category][level] ? INFRACTION_CONFIG[category][level].duration : 'instantané');
    let expiresAt = null;

    if (duration && duration !== 'permanent' && duration !== 'instantané') {
        const ms = parseDuration(duration);
        if (ms) {
            expiresAt = new Date(Date.now() + ms).toISOString();
        }
    }

    const sanction = {
        type,
        level, // 1, 2, or 3
        moderator,
        reason: reason || gravityLabel,
        category,
        gravity: gravityLabel,
        duration,
        timestamp: new Date().toISOString(),
        expiresAt
    };

    sanctions[guildId][userId].push(sanction);
    saveSanctions(sanctions);

    return sanction;
}

function clearUserSanctions(guildId, userId) {
    const sanctions = loadSanctions();
    if (sanctions[guildId]) {
        delete sanctions[guildId][userId];
        saveSanctions(sanctions);
    }
}

module.exports = {
    INFRACTION_CONFIG,
    parseDuration,
    loadSanctions,
    saveSanctions,
    addSanction,
    clearUserSanctions
};