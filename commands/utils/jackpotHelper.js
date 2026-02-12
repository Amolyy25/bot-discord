const { EmbedBuilder } = require("discord.js");
const fs = require('fs');
const path = require('path');

const JACKPOT_FILE = path.join(__dirname, '../../jackpot.json');

const CONFIG = {
  // Le salon par défaut pour le Jackpot
  CHANNEL_ID: "1469071689798000676", // ID GÉNÉRAL (mis à jour selon demande user: "dans général")
  PING_ROLE_ID: "1469071689756442798", // Rôle à ping
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
            // Initialisation avec structure de base
            const initialData = { nextJackpot: null, activeRoles: {}, lastJackpot: null };
            fs.writeFileSync(JACKPOT_FILE, JSON.stringify(initialData));
            return initialData;
        }
        const data = JSON.parse(fs.readFileSync(JACKPOT_FILE, 'utf8'));
        // S'assurer que les propriétés existent
        if (!data.activeRoles) data.activeRoles = {};
        return data;
    } catch (e) {
        console.error('[Jackpot] Erreur chargement JSON:', e);
        return { nextJackpot: null, activeRoles: {}, lastJackpot: null };
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

  // 1. Restaurer les expirations de rôles (Nettoyage au démarrage)
  if (data.activeRoles) {
      for (const [userId, roleData] of Object.entries(data.activeRoles)) {
          // Si données corrompues ou incomplètes, skip
          if (!roleData || !roleData.roleId || !roleData.expiration) continue;
          
          if (roleData.expiration > now) {
              const delay = roleData.expiration - now;
              console.log(`[Jackpot] Restauration suppression rôle pour ${userId} dans ${(delay/1000/60).toFixed(1)} min`);
              
              // On utilise un timeout différé car on a besoin que le client soit prêt
              setTimeout(() => {
                  removeRoleNow(client, userId, roleData.roleId);
              }, delay);
          } else {
              // Déjà expiré pendant l'arrêt
              console.log(`[Jackpot] Suppression immédiate rôle expiré pour ${userId}`);
              setTimeout(() => {
                  removeRoleNow(client, userId, roleData.roleId);
              }, 5000); // Petit délai boot
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
    
    // Si on a déjà une date prévue dans le futur, on garde
    if (data.nextJackpot) {
        const nextDate = new Date(data.nextJackpot);
        if (nextDate > now) {
            console.log(`[Jackpot] 📅 Prochain événement déjà prévu : ${nextDate.toLocaleString('fr-FR')}`);
            return;
        }
        // Si nextJackpot est dans le passé, c'est qu'on l'a raté (ex: bot éteint) ou qu'il vient de se passer
        // On vérifie lastJackpot pour savoir si on a déjà joué aujourd'hui
    }

    // A-t-on déjà joué aujourd'hui ?
    if (data.lastJackpot) {
        const lastDate = new Date(data.lastJackpot);
        if (lastDate.toLocaleDateString('fr-FR') === todayStr) {
            console.log('[Jackpot] ✅ Événement déjà effectué aujourd\'hui. Planification pour demain.');
            scheduleForTomorrow();
            return;
        }
    }

    // Si on arrive ici, c'est qu'on doit jouer aujourd'hui (ou qu'on a raté le slot d'aujourd'hui et qu'il est tard)
    scheduleForTodayOrTomorrow();
}

function scheduleForTomorrow() {
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setDate(targetTime.getDate() + 1); // Demain
    
    // Créneau 10h - 22h
    const minHour = 10;
    const maxHour = 22;
    
    // Début du créneau demain 10h
    targetTime.setHours(minHour, 0, 0, 0);
    const startMillis = targetTime.getTime();
    
    // Fin du créneau demain 22h
    const endWindow = new Date(targetTime);
    endWindow.setHours(maxHour, 0, 0, 0);
    const endMillis = endWindow.getTime();
    
    // Random
    const randomTime = startMillis + Math.random() * (endMillis - startMillis);
    
    const data = loadJackpotData();
    data.nextJackpot = randomTime;
    saveJackpotData(data);
    
    console.log(`[Jackpot] 📅 Nouveau créneau généré pour DEMAIN : ${new Date(randomTime).toLocaleString()}`);
}

function scheduleForTodayOrTomorrow() {
    const now = new Date();
    const minHour = 10;
    const maxHour = 22;
    
    // Si il est déjà passé 22h, c'est mort pour aujourd'hui -> demain
    if (now.getHours() >= maxHour) {
        scheduleForTomorrow();
        return;
    }

    // Calcul du début de la plage possible pour aujourd'hui
    let startMillis;
    if (now.getHours() < minHour) {
        // Si avant 10h, début à 10h
        const start = new Date(now);
        start.setHours(minHour, 0, 0, 0);
        startMillis = start.getTime();
    } else {
        // Si entre 10h et 22h, début maintenant + petit délai (ex: 1 min min)
        startMillis = now.getTime() + 60000; 
    }
    
    // Fin à 22h aujourd'hui
    const endWindow = new Date(now);
    endWindow.setHours(maxHour, 0, 0, 0);
    const endMillis = endWindow.getTime();
    
    // Sécurité: si start >= end (ex: il est 21h59m59s), on force demain ou immédiat ?
    if (startMillis >= endMillis) {
         scheduleForTomorrow();
         return;
    }

    const randomTime = startMillis + Math.random() * (endMillis - startMillis);
    
    const data = loadJackpotData();
    data.nextJackpot = randomTime;
    saveJackpotData(data);
    
    console.log(`[Jackpot] 📅 Nouveau créneau généré pour AUJOURD'HUI : ${new Date(randomTime).toLocaleString()}`);
}

/**
 * Appelé par le CRON chaque minute pour vérifier s'il faut lancer
 */
function checkCron(client) {
    const data = loadJackpotData();
    
    // Si pas de date, on en génère une (filet de sécurité)
    if (!data.nextJackpot) {
        checkAndScheduleNextJackpot();
        return;
    }

    const now = Date.now();
    // Si l'heure est passée (et qu'on n'a pas déjà joué aujourd'hui, vérifié par la logique de schedule)
    if (now >= data.nextJackpot) {
        console.log('[Jackpot] ⏰ C\'est l\'heure du Jackpot !');
        
        // On lance
        launchJackpot(client);
        
        // Update state
        data.lastJackpot = now;
        data.nextJackpot = null; // On vide pour forcer une replanification au prochain tick
        saveJackpotData(data);
        
        // On demande immédiatement de calculer le prochain (sera demain)
        setTimeout(() => checkAndScheduleNextJackpot(), 5000);
    }
}

/**
 * Lance l'événement Jackpot Chrono
 * @param {import('discord.js').Client} client
 * @param {string} [overrideChannelId] ID du salon à utiliser (optionnel)
 */
async function launchJackpot(client, overrideChannelId) {
  try {
    // Si overrideChannelId est fourni (via commande), on l'utilise.
    // Sinon on utilise CONFIG.CHANNEL_ID (Général)
    const channelId = overrideChannelId || CONFIG.CHANNEL_ID;
    
    const channel = await client.channels.fetch(channelId).catch(e => {
        console.error(`[Jackpot] Erreur accès salon ${channelId}:`, e);
        return null;
    });

    if (!channel) return console.error(`[Jackpot] Salon ${channelId} introuvable ou inaccessible`);

    const randomReaction = CONFIG.REACTIONS[Math.floor(Math.random() * CONFIG.REACTIONS.length)];

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🎰 JACKPOT CHRONO")
      .setDescription(
        `Un siège vient de se libérer dans l'avion du QG ! ✈️\nPremier à cliquer sur ${randomReaction} gagne son rang !\n\nBonne chance à tous !`,
      )
      .setThumbnail(
        "https://cdn.discordapp.com/attachments/1469071690695704887/1471440449783730242/Gemini_Generated_Image_nvdzqgnvdzqgnvdz_1.png?ex=698ef135&is=698d9fb5&hm=f4004d5245ad76914d02f783db9d611b8cd117beb867de7e93e288d760767bb7&",
      )
      .setFooter({ text: "Événement Flash - Soyez rapide !" })
      .setTimestamp();

    // Message avec PING du rôle demandé
    const messageContent = `🚨 **JACKPOT CHRONO DÉTECTÉ !** <@&${CONFIG.PING_ROLE_ID}> Vite ! Soyez le premier à cliquer sur la réaction ci-dessous pour monter à bord ! ✈️`;

    const message = await channel.send({
      content: messageContent,
      embeds: [embed],
    });

    await message.react(randomReaction);

    // Filtre : bonne réaction + pas un bot
    const filter = (reaction, user) => {
        return reaction.emoji.name === randomReaction && !user.bot;
    };

    const collector = message.createReactionCollector({
      filter,
      max: 1, // Le premier gagne
      time: 3600000, // 1h max de validité (sécurité)
    });

    console.log(`[Jackpot] Lancé dans ${channel.name} (${channelId})`);

    collector.on("collect", async (reaction, user) => {
      console.log(`[Jackpot] GAGNANT: ${user.tag} (${user.id})`);
      
      const member = await channel.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // Tirage au sort du rôle
      const wonRole = drawRole();
      
      try {
        // Retirer les autres rôles de classe (pour éviter les doublons de rangs)
        const roleIdsToRemove = CONFIG.ROLES.map((r) => r.id);
        await member.roles.remove(roleIdsToRemove).catch((e) => console.warn("Erreur retrait roles:", e));

        // Ajouter le nouveau rôle
        await member.roles.add(wonRole.id);

        await channel.send(
          `🏆 **FÉLICITATIONS ${user} !** Tu passes en **${wonRole.name}** ! Profite bien de ta visibilité pendant 24h ! ✈️✨`
        );

        // Sauvegarder l'attribution pour persistance
        const expiration = Date.now() + (24 * 60 * 60 * 1000);
        const data = loadJackpotData();
        data.activeRoles[user.id] = {
            roleId: wonRole.id,
            expiration: expiration
        };
        saveJackpotData(data);

        // Programmer la suppression
        scheduleRoleRemoval(client, user.id, wonRole.id, expiration);

        // Supprimer le message original du Jackpot pour nettoyer
        await message.delete().catch(() => {});

      } catch (error) {
        console.error(`[Jackpot] Erreur attribution rôle:`, error);
        channel.send(`Oups, une erreur est survenue lors de la remise du lot à ${user}... Contactez un admin !`);
      }
    });
    
    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            message.edit({ content: "⏳ **Jackpot expiré !** L'avion est parti sans passager supplémentaire...", embeds: [] }).catch(() => {});
            message.reactions.removeAll().catch(() => {});
        }
    });

  } catch (error) {
    console.error("[Jackpot] Erreur critique lors du lancement:", error);
  }
}

function scheduleRoleRemoval(client, userId, roleId, expirationTimestamp) {
    const delay = expirationTimestamp - Date.now();
    if (delay <= 0) {
        removeRoleNow(client, userId, roleId);
        return;
    }

    // setTimeout max est 24.8 jours, donc 24h c'est ok.
    setTimeout(() => {
        removeRoleNow(client, userId, roleId);
    }, delay);
}

async function removeRoleNow(client, userId, roleId) {
    try {
        // On essaie de retrouver la guilde via le channel configuré
        const channel = await client.channels.fetch(CONFIG.CHANNEL_ID).catch(() => null);
        if (!channel) return;
        
        const guild = channel.guild;
        const member = await guild.members.fetch(userId).catch(() => null);
        
        if (member) {
            await member.roles.remove(roleId).catch(() => {});
            console.log(`[Jackpot] Rôle temporaire retiré de ${member.user.tag}`);
        }
        
        // Nettoyer JSON
        const data = loadJackpotData();
        if (data.activeRoles && data.activeRoles[userId]) {
            delete data.activeRoles[userId];
            saveJackpotData(data);
        }
    } catch (e) {
        console.error(`[Jackpot] Erreur suppression rôle différée:`, e);
    }
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
  return CONFIG.ROLES[0]; 
}

module.exports = { init, launchJackpot, checkCron };
