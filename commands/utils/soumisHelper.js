const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../soumisData.json');

function loadData() {
    if (fs.existsSync(dataPath)) {
        try {
            return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function saveUserRoles(guildId, userId, roles) {
    const data = loadData();
    if (!data[guildId]) data[guildId] = {};
    data[guildId][userId] = roles;
    saveData(data);
}

function getUserRoles(guildId, userId) {
    const data = loadData();
    if (data[guildId] && data[guildId][userId]) {
        const roles = data[guildId][userId];
        delete data[guildId][userId];
        saveData(data);
        return roles;
    }
    return null;
}

module.exports = {
    saveUserRoles,
    getUserRoles
};
