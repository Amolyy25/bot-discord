const assert = require('assert');
const { checkAndConsumeRole, addPermission, ROLES } = require('../commands/utils/permHelper');
const fs = require('fs');
const path = require('path');

// Mock fs
const mockPermissionsFile = path.join(__dirname, '../permissions.json');
const mockUsageFile = path.join(__dirname, '../commandUsage.json');

// Mock Discord structures
class MockMember {
    constructor(id, roles) {
        this.id = id;
        this.user = { tag: `User${id}` };
        this.roles = {
            cache: new Set(roles),
            add: async (id) => this.roles.cache.add(id),
            remove: async (id) => {
                if (this.roles.cache.has(id)) {
                    this.roles.cache.delete(id);
                    return true;
                }
                return false;
            },
            has: (id) => this.roles.cache.has(id)
        };
    }
}

// Reset files before tests
function resetFiles() {
    fs.writeFileSync(mockPermissionsFile, JSON.stringify({}));
    fs.writeFileSync(mockUsageFile, JSON.stringify({}));
}

async function runTests() {
    console.log('🧪 Démarrage des tests unitaires pour permHelper...');

    // Test 1: Basic Limit (1 use)
    console.log('\nTest 1: Limite simple (1 utilisation)');
    resetFiles();
    const roleId = 'role1';
    const command = 'testcmd';
    
    // Setup permission
    addPermission(command, 'role', roleId, 1);
    
    const member = new MockMember('user1', [roleId]);
    
    // Execute
    await checkAndConsumeRole(member, command);
    
    assert(!member.roles.has(roleId), 'Le rôle aurait dû être retiré');
    console.log('✅ Rôle retiré correctement.');
    
    // Test 2: Reset behavior (Get role back)
    console.log('\nTest 2: Reset et ré-obtention du rôle');
    member.roles.add(roleId); // User gets role back
    
    await checkAndConsumeRole(member, command);
    
    assert(!member.roles.has(roleId), 'Le rôle aurait dû être retiré une 2ème fois');
    console.log('✅ Rôle retiré correctement après ré-obtention (Reset confirmé).');

    // Test 3: Multiple Roles (Chain Reaction) - The "Infallible" requirement
    console.log('\nTest 3: Suppression en chaîne (Plusieurs rôles)');
    resetFiles();
    const roleA = 'roleA'; // Limit 1
    const roleB = 'roleB'; // Limit 5
    
    addPermission(command, 'role', roleA, 1);
    addPermission(command, 'role', roleB, 5); // Higher limit
    
    const memberMulti = new MockMember('user2', [roleA, roleB]);
    
    await checkAndConsumeRole(memberMulti, command);
    
    const hasA = memberMulti.roles.has(roleA);
    const hasB = memberMulti.roles.has(roleB);
    
    console.log(`État final: Role A: ${hasA}, Role B: ${hasB}`);
    
    if (!hasA && !hasB) {
        console.log('✅ Tous les rôles ont été retirés (Comportement robuste souhaité).');
    } else if (!hasA && hasB) {
        console.log('⚠️ Seul le rôle A est parti (Comportement standard actuel).');
        console.log('   -> Nous allons modifier le code pour que B parte aussi.');
    } else {
        console.error('❌ Comportement inattendu.');
    }
}

runTests().catch(console.error);
