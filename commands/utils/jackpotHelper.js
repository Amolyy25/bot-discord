const { EmbedBuilder } = require("discord.js");

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

/**
 * Initialise le Jackpot Chrono
 * @param {import('discord.js').Client} client
 */
function init(client) {
  console.log("Jackpot Chrono initialisé");
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
      .setThumbnail("https://i.imgur.com/mJ7u88r.png") // Optionnel: une image d'avion ou jackpot
      .setFooter({ text: "Événement Flash - Soyez rapide !" })
      .setTimestamp();

    const message = await channel.send({
      content:
        "🚨 **JACKPOT CHRONO DÉTECTÉ !** Vite ! Soyez le premier à cliquer sur la réaction ci-dessous pour monter à bord ! ✈️",
      embeds: [embed],
    });

    await message.react(randomReaction);

    const filter = (reaction, user) => {
      return reaction.emoji.name === randomReaction && !user.bot;
    };

    const collector = message.createReactionCollector({
      filter,
      max: 1,
      time: 3600000,
    }); // 1h max pour cliquer

    collector.on("collect", async (reaction, user) => {
      const member = await channel.guild.members
        .fetch(user.id)
        .catch(() => null);
      if (!member) return;

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

        // Programmer la suppression après 24h
        setTimeout(
          async () => {
            try {
              const m = await channel.guild.members
                .fetch(user.id)
                .catch(() => null);
              if (m) {
                await m.roles.remove(wonRole.id).catch(() => {});
                console.log(
                  `[Jackpot] Rôle ${wonRole.name} retiré de ${user.tag} après 24h`,
                );
              }
            } catch (err) {
              console.error(
                `[Jackpot] Erreur lors du retrait du rôle après 24h:`,
                err,
              );
            }
          },
          24 * 60 * 60 * 1000,
        );
      } catch (error) {
        console.error(`[Jackpot] Erreur lors de l'attribution du rôle:`, error);
      }
    });
  } catch (error) {
    console.error("[Jackpot] Erreur lors du lancement:", error);
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
  return CONFIG.ROLES[0]; // Par défaut le premier
}

module.exports = { init, launchJackpot };
