const { EmbedBuilder } = require("discord.js");
const fs = require('fs');
const path = require('path');

const JACKPOT_FILE = path.join(__dirname, '../../jackpot.json');

const CONFIG = {
  CHANNEL_ID: "1469071691941412962",
  ROLES: [
    { id: "1471433193608712192", name: "Voyageur (Commun)", chance: 60 },
    { id: "1471431589081780224", name: "Hotesse (Rare)", chance: 25 },
    { id: "1471431515283132552", name: "FIRST CLASSE (Très Rare)", chance: 10 },
    {
      id: "1471431323645378766",
      name: "BUSINESS CLASS (Ultra Rare)",
      chance: 5,
    },
  ],
  REACTIONS: ["🚀", "💎", "🔥", "🎰", "⚡", "✈️", "🌟", "👑", "💰", "🚁"],
};

// --- Persistance ---

function loadJackpotData() {
    try {
        if (!fs.existsSync(JACKPOT_FILE)) {
            fs.writeFileSync(JACKPOT_FILE, JSON.stringify({ nextJackpot: null, activeRoles: {} }));
            return { nextJackpot: null, activeRoles: {} };
        }
        return JSON.parse(fs.readFileSync(JACKPOT_FILE, 'utf8'));
    } catch (e) {
        console.error('[Jackpot] Erreur chargement JSON:', e);
        return { nextJackpot: null, activeRoles: {} };
    }
}

function saveJackpotData(data) {
    try {
        fs.writeFileSync(JACKPOT_FILE, JSON.stringify(data, null, 4));
    } catch (e) {
        console.error('[Jackpot] Erreur sauvegarde JSON:', e);
    }
}

// --- Fonctions ---

/**
 * Initialise le Jackpot Chrono : restaure les rôles et planifie le prochain tirage si nécessaire
 * @param {import('discord.js').Client} client
 */
async function init(client) {
  console.log("Jackpot Chrono initialisé");
  
  const data = loadJackpotData();
  const now = Date.now();

  // 1. Restaurer les expirations de rôles
  if (data.activeRoles) {
      for (const [userId, roleData] of Object.entries(data.activeRoles)) {
          if (!roleData || !roleData.expiration) continue;
          
          if (roleData.expiration > now) {
              const delay = roleData.expiration - now;
              console.log(`[Jackpot] Restauration suppression rôle pour ${userId} dans ${(delay/1000/60).toFixed(1)} min`);
              
              // On utilise un timeout différé car on a besoin que le client soit prêt
              setTimeout(() => {
                  scheduleRoleRemoval(client, userId, roleData.roleId, roleData.expiration);
              }, 5000); // Petit délai pour laisser le temps au bot de se connecter pleinement
          } else {
              // Déjà expiré pendant l'arrêt
              setTimeout(() => {
                  removeRoleNow(client, userId, roleData.roleId);
              }, 5000);
          }
      }
  }

  // 2. Vérifier/Générer l'heure du jackpot d'aujourd'hui
  checkAndScheduleNextJackpot();
}

/**
 * Vérifie si un jackpot est prévu aujourd'hui, sinon en planifie un
 */
function checkAndScheduleNextJackpot() {
    const data = loadJackpotData();
    const now = new Date();
    const todayStr = now.toLocaleDateString('fr-FR');
    
    // Si on a déjà une date prévue
    if (data.nextJackpot) {
        const nextDate = new Date(data.nextJackpot);
        // Si c'est aujourd'hui et dans le futur, c'est bon
        if (nextDate.toLocaleDateString('fr-FR') === todayStr && nextDate > now) {
            console.log(`[Jackpot] Prochain événement prévu à ${nextDate.toLocaleTimeString()}`);
            return;
        }
        // Si c'est passé (hier ou plus tôt), on doit en replanifier un pour aujourd'hui
        // Sauf si on l'a déjà fait aujourd'hui ? (Non, on part du principe qu'on en veut un par jour)
        // Mais attention : si on redémarre à 23h et qu'on a déjà eu un jackpot à 14h, nextJackpot sera dans le passé.
        // Comment savoir si "le jackpot d'aujourd'hui est déjà passé" ?
        // => On peut stocker "lastJackpotDate"
    }

    // Simplification : On planifie toujours un jackpot pour "aujourd'hui entre 10h et 22h"
    // Si il est actuellement 15h, on planifie entre 15h et 22h.
    // Si il est 23h, on planifie pour demain 10h-22h.

    let targetTime = new Date();
    let minHour = 10;
    let maxHour = 22;

    if (now.getHours() >= maxHour) {
        // Trop tard pour aujourd'hui, on passe à demain
        targetTime.setDate(targetTime.getDate() + 1);
        targetTime.setHours(minHour, 0, 0, 0); // Reset à 10h00 demain
    } 
    
    // Si on est avant 10h, le créneau commence à 10h
    // Si on est entre 10h et 22h, le créneau commence "maintenant"
    
    let startMillis = targetTime.getTime();
    if (targetTime.getHours() < minHour) {
        targetTime.setHours(minHour, 0, 0, 0);
        startMillis = targetTime.getTime();
    } else if (targetTime.getHours() >= minHour && targetTime.getHours() < maxHour) {
        // On est déjà dans le créneau, startMillis = now
        // SAUF si nextJackpot était déjà aujourd'hui mais passé (donc déjà joué).
        // Pour éviter de rejouer en boucle au redémarrage si on a déjà joué :
        if (data.lastJackpot && new Date(data.lastJackpot).toLocaleDateString('fr-FR') === todayStr) {
             console.log('[Jackpot] Événement déjà eu lieu aujourd\'hui.');
             // On planifie pour demain
             targetTime.setDate(targetTime.getDate() + 1);
             targetTime.setHours(minHour, 0, 0, 0);
             startMillis = targetTime.getTime();
        }
    }

    // Calcul de l'heure aléatoire
    // Fin du créneau : le jour de targetTime à 22h
    const endWindow = new Date(targetTime);
    endWindow.setHours(maxHour, 0, 0, 0);
    const endMillis = endWindow.getTime();

    // Random entre startMillis et endMillis
    const randomTime = startMillis + Math.random() * (endMillis - startMillis);
    
    data.nextJackpot = randomTime;
    saveJackpotData(data);
    
    console.log(`[Jackpot] Nouveau créneau généré : ${new Date(randomTime).toLocaleString()}`);
}

/**
 * Appelé par le CRON chaque minute (ou heure) pour vérifier s'il faut lancer
 */
function checkCron(client) {
    const data = loadJackpotData();
    if (!data.nextJackpot) {
        checkAndScheduleNextJackpot();
        return;
    }

    const now = Date.now();
    if (now >= data.nextJackpot) {
        // C'est l'heure !
        console.log('[Jackpot] Lancement planifié !');
        launchJackpot(client);
        
        // Marquer comme fait et nettoyer
        data.lastJackpot = now;
        data.nextJackpot = null; // On attend le prochain check pour replanifier demain
        saveJackpotData(data);
        
        // Replanifier pour demain immédiatement pour éviter les doublons si le cron tourne vite
        checkAndScheduleNextJackpot();
    }
}

/**
 * Lance l'événement Jackpot Chrono
 * @param {import('discord.js').Client} client
 * @param {string} [overrideChannelId] ID du salon à utiliser (optionnel, pour les tests)
 */
async function launchJackpot(client, overrideChannelId) {
  try {
    const channelId = overrideChannelId || CONFIG.CHANNEL_ID;
    const channel = await client.channels.fetch(channelId);
    if (!channel)
      return console.error(`[Jackpot] Salon ${channelId} introuvable`);

    const randomReaction =
      CONFIG.REACTIONS[Math.floor(Math.random() * CONFIG.REACTIONS.length)];

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🎰 JACKPOT CHRONO")
      .setDescription(
        `Un siège vient de se libérer dans l'avion du QG ! ✈️\nPremier à cliquer sur ${randomReaction} gagne son rang !\n\nBonne chance à tous !`,
      )
      .setThumbnail(
        "https://cdn.discordapp.com/attachments/1469071690695704887/1471440449783730242/Gemini_Generated_Image_nvdzqgnvdzqgnvdz_1.png?ex=698ef135&is=698d9fb5&hm=f4004d5245ad76914d02f783db9d611b8cd117beb867de7e93e288d760767bb7&",
      ) // Optionnel: une image d'avion ou jackpot
      .setFooter({ text: "Événement Flash - Soyez rapide !" })
      .setTimestamp();

    const message = await channel.send({
      content:
        "🚨 **JACKPOT CHRONO DÉTECTÉ !** Vite ! Soyez le premier à cliquer sur la réaction ci-dessous pour monter à bord ! ✈️",
      embeds: [embed],
    });

    await message.react(randomReaction);

    const filter = (reaction, user) => {
        const isMatch = reaction.emoji.name === randomReaction;
        const isNotBot = !user.bot;
        return isMatch && isNotBot;
    };

    const collector = message.createReactionCollector({
      filter,
      max: 1,
      time: 3600000,
    }); // 1h max pour cliquer

    console.log('[Jackpot] Collecteur de réactions créé. En attente...');

    collector.on("collect", async (reaction, user) => {
      console.log(`[Jackpot] Réaction valide collectée: ${reaction.emoji.name} par ${user.tag} (${user.id})`);
      
      const member = await message.guild.members.fetch(user.id).catch(e => {
        console.error(`[Jackpot] Erreur fetch membre:`, e);
        return null;
      });
      
      if (!member) {
          console.log(`[Jackpot] Membre ${user.tag} introuvable ou erreur de fetch`);
          return;
      }

      // Tirage au sort du rôle
      const wonRole = drawRole();
      
      // Attribution intelligente
      try {
        // Retirer les autres rôles de classe
        const roleIds = CONFIG.ROLES.map((r) => r.id);
        await member.roles.remove(roleIds).catch(() => {});

        // Ajouter le nouveau rôle
        await member.roles.add(wonRole.id);

        await channel.send(
          `🏆 **FÉLICITATIONS ${user} !** Tu passes en **${wonRole.name}** ! Profite bien de ta visibilité pendant 24h ! ✈️✨`,
        );

        // Sauvegarder l'attribution pour persistance
        const expiration = Date.now() + (24 * 60 * 60 * 1000);
        const data = loadJackpotData();
        data.activeRoles[user.id] = {
            roleId: wonRole.id,
            expiration: expiration
        };
        saveJackpotData(data);

        // Programmer la suppression (mémoire vive)
        scheduleRoleRemoval(client, user.id, wonRole.id, expiration);

        // Supprimer le message original du Jackpot
        try {
            await message.delete();
        } catch (delError) {
            console.error('[Jackpot] Impossible de supprimer le message:', delError);
        }

      } catch (error) {
        console.error(`[Jackpot] Erreur lors de l'attribution du rôle:`, error);
      }
    });
  } catch (error) {
    console.error("[Jackpot] Erreur lors du lancement:", error);
  }
}

function scheduleRoleRemoval(client, userId, roleId, expirationTimestamp) {
    const delay = expirationTimestamp - Date.now();
    if (delay <= 0) {
        removeRoleNow(client, userId, roleId);
        return;
    }

    setTimeout(() => {
        removeRoleNow(client, userId, roleId);
    }, delay);
}

async function removeRoleNow(client, userId, roleId) {
    try {
        const guild = await client.guilds.fetch('1469071689399926790').catch(() => null); // ID serveur à hardcoder ou récupérer via config
        // Alternative : récupérer le channel config
        if (!guild) {
             // Fallback: essayer via le channel ID config
             const channel = await client.channels.fetch(CONFIG.CHANNEL_ID).catch(() => null);
             if (channel) await removeRoleFromGuild(channel.guild, userId, roleId);
             return;
        }
        await removeRoleFromGuild(guild, userId, roleId);
    } catch (e) {
        console.error(`[Jackpot] Erreur suppression rôle différée:`, e);
    }
}

async function removeRoleFromGuild(guild, userId, roleId) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
        await member.roles.remove(roleId).catch(() => {});
        console.log(`[Jackpot] Rôle retiré de ${member.user.tag}`);
    }
    
    // Nettoyer JSON
    const data = loadJackpotData();
    delete data.activeRoles[userId];
    saveJackpotData(data);
}

function drawRole() {
  const rand = Math.random() * 100;
  let cumulativeChance = 0;

  for (const role of CONFIG.ROLES) {
    cumulativeChance += role.chance;
    if (rand <= cumulativeChance) {
      return role;
    }
  }
  return CONFIG.ROLES[0]; // Par défaut le premier
}

module.exports = { init, launchJackpot, checkCron };