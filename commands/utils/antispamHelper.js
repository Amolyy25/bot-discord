const { addSanction, parseDuration } = require("./sanctionsHelper");
const { saveUserRoles } = require("./soumisHelper");
const { logModAction } = require("./logHelper");

// ═══════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════

const CONFIG = {
  // Seuils de spam (messages rapides)
  MESSAGE_LIMIT: 5, // Max messages autorisés
  TIME_WINDOW: 5000, // Fenêtre de 5 secondes

  // Messages dupliqués
  DUPLICATE_LIMIT: 3, // Même message répété X fois
  DUPLICATE_WINDOW: 30000, // Fenêtre de 30 secondes

  // Mention spam
  MENTION_LIMIT: 5, // Max mentions par message

  // Sanctions progressives
  TEMPMUTE_DURATION: "20m", // Durée du tempmute (strike 2)

  // Gestion des gros mots
  TOXIC_WINDOW: 20000, // Fenêtre de 20 secondes pour compter les insultes
  TOXIC_THRESHOLD_WORDS: 5, // Nombre total d'insultes dans la fenêtre avant action
  TOXIC_THRESHOLD_MESSAGES: 3, // Nombre de messages insultants avant action
  TOXIC_WORDS_IN_MESSAGE_THRESHOLD: 4, // Insultes dans un seul message pour déclencher direct

  // Avertissement soft pour le spam (sans strike)
  SOFT_SPAM_WINDOW: 30000, // 30s entre deux avertissements "moin vite, détend toi"

  // Decay des strikes
  STRIKE_DECAY: 300000, // Reset après 5 min sans infraction

  // Nettoyage mémoire
  CLEANUP_INTERVAL: 60000, // Nettoyage toutes les 60s
  DATA_EXPIRY: 600000, // Données expirées après 10 min

  // Raid detection (comportement groupe)
  RAID_THRESHOLD: 3, // Nombre d'users spam simultanés
  RAID_WINDOW: 10000, // Fenêtre de détection raid (10s)

  // Sources de raid (invites provenant d'utilisateurs sanctionnés)
  RAID_SOURCE_DURATION: 2 * 60 * 60 * 1000, // 2h

  // Cooldown warning (éviter le spam de warnings)
  WARNING_COOLDOWN: 10000, // 10s entre chaque warning par user
};

// ═══════════════════════════════════════════════════════
// LISTE DE MOTS TOXIQUES (normalisés, lowercase, sans accents)
// ═══════════════════════════════════════════════════════

const TOXIC_WORDS = new Set([
  // Insultes courantes
  "fdp",
  "fils de pute",
  "filsdepute",
  "nique",
  "ntm",
  "niquetamere",
  "nique ta mere",
  "niquer",
  "enculer",
  "encule",
  "enculé",
  "batard",
  "bâtard",
  "connard",
  "connasse",
  "salope",
  "salop",
  "pute",
  "putain",
  "petasse",
  "pétasse",
  "grosse pute",
  "ta gueule",
  "tagueule",
  "tg",
  "ferme ta gueule",
  "va te faire foutre",
  "vtff",
  "va te faire",
  "pd",
  "pédé",
  "pede",
  "tapette",
  "tarlouze",
  "gogol",
  "mongol",
  "debile",
  "débile",
  "attardé",
  "attarde",
  "retardé",
  "retarde",
  "autiste",
  "negre",
  "nègre",
  "negro",
  "négro",
  "bougnoule",
  "bougnoul",
  "sale arabe",
  "sale noir",
  "sale blanc",
  "sale juif",
  "youpin",
  "feuj",
  "suceuse",
  "suceur",
  "suce moi",
  "suce",
  "bouffon",
  "boufon",
  "abruti",
  "cretin",
  "crétin",
  "triso",
  "trisomique",
  "conne",
  "con",
  "gros con",
  "grosse conne",
  "merde",
  "de merde",
  "demerde",
  "baisé",
  "baise",
  "baiser",
  "niker",
  "niké",
  "chienne",
  "chien",
  "fils de chien",
  "porc",
  "truie",
  "sale race",
  "cancer",
  "cancéreux",
  "cancereux",
  "suicid",
  "tue toi",
  "tue-toi",
  "tuetoi",
  "creve",
  "crève",
  "va crever",
  "sous merde",
  "sous-merde",
  "sousmerde",
  "dechet",
  "déchet",
  "dechet humain",
  "avorton",
  "raclure",
  "ordure",
  "pouffiasse",
  "poufiasse",
  "branleur",
  "branleuse",
  "branlé",
  "couille",
  "couilles",
  "wesh", // pas toxique seul mais combiné
  "zebi",
  "zob",
  "zobri",
]);

// Mots qui déclenchent SEULEMENT s'ils sont combinés avec d'autres signes de toxicité
const SOFT_TOXIC = new Set(["merde", "con", "conne", "wesh", "chien", "porc"]);

// ═══════════════════════════════════════════════════════
// TRACKING EN MÉMOIRE
// ═══════════════════════════════════════════════════════

// Map<userId, UserData>
const userTracker = new Map();
// Structure UserData: {
//   messages: [{timestamp, content, channelId}],
//   strikes: number,
//   lastStrike: number (timestamp),
//   lastWarning: number (timestamp),
//   lastSoftWarning: number (timestamp),
//   isMuted: boolean,
//   toxicMessages: [{ timestamp, count }],
// }

// Timestamps des détections de spam (pour raid detection instantané)
const spamDetections = [];

// Anti-raid : utilisateurs considérés comme sources de raid
// Map<guildId, Map<userId, { expiresAt: number, reason: string }>>
const raidSources = new Map();

// Tracking des invites pour savoir par qui un membre a rejoint
// Map<guildId, Map<inviteCode, uses>>
const guildInvites = new Map();

// IDs des rôles staff (chargés au démarrage)
let staffRoleIds = new Set();
let botUserId = null;

// ═══════════════════════════════════════════════════════
// NORMALISATION DE TEXTE
// ═══════════════════════════════════════════════════════

// Table de conversion l33t speak
const LEET_MAP = {
  0: "o",
  1: "i",
  3: "e",
  4: "a",
  5: "s",
  7: "t",
  8: "b",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "l",
  "+": "t",
};

/**
 * Normalise un texte pour la détection :
 * - Lowercase
 * - Supprime les accents
 * - Convertit le l33t speak
 * - Supprime les caractères spéciaux répétés
 * - Collapse les espaces multiples
 */
function normalizeText(text) {
  let normalized = text.toLowerCase();

  // Supprimer les accents
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Convertir l33t speak
  normalized = normalized
    .split("")
    .map((c) => LEET_MAP[c] || c)
    .join("");

  // Supprimer les caractères répétés (ex: "puuuuute" → "pute")
  normalized = normalized.replace(/(.)\1{2,}/g, "$1$1");

  // Supprimer les caractères spéciaux entre les lettres (ex: "p.u.t.e" → "pute")
  // Loop pour gérer les cas multiples (p.u.t.e → pu.te → pute)
  let prev;
  do {
    prev = normalized;
    normalized = normalized.replace(/([a-z])[^a-z\s]([a-z])/g, "$1$2");
  } while (normalized !== prev);

  // Collapse espaces multiples
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Vérifie si le texte contient des mots toxiques.
 * Retourne { toxic: boolean, words: string[] }
 */
function detectToxicContent(text) {
  const normalized = normalizeText(text);
  const foundWords = [];

  // Check phrases complètes d'abord (priorité aux expressions multi-mots)
  for (const phrase of TOXIC_WORDS) {
    if (phrase.includes(" ") && normalized.includes(phrase)) {
      if (!SOFT_TOXIC.has(phrase)) {
        foundWords.push(phrase);
      }
    }
  }

  // Check mots individuels
  const words = normalized.split(/\s+/);
  for (const word of words) {
    // Nettoyer le mot (enlever ponctuation)
    const cleanWord = word.replace(/[^a-z]/g, "");
    if (cleanWord.length < 2) continue;

    if (TOXIC_WORDS.has(cleanWord) && !SOFT_TOXIC.has(cleanWord)) {
      foundWords.push(cleanWord);
    }

    // Check partiel pour les variantes (ex: "enculééé" normalisé)
    for (const toxic of TOXIC_WORDS) {
      if (SOFT_TOXIC.has(toxic)) continue;
      if (
        toxic.length >= 4 &&
        cleanWord.length >= toxic.length &&
        cleanWord.includes(toxic)
      ) {
        if (!foundWords.includes(toxic)) {
          foundWords.push(toxic);
        }
      }
    }
  }

  return {
    toxic: foundWords.length > 0,
    words: foundWords,
  };
}

// ═══════════════════════════════════════════════════════
// CORE : TRACKING & DÉTECTION
// ═══════════════════════════════════════════════════════

/**
 * Récupère ou crée les données d'un user
 */
function getUserData(userId) {
  if (!userTracker.has(userId)) {
    userTracker.set(userId, {
      messages: [],
      strikes: 0,
      lastStrike: 0,
      lastWarning: 0,
      lastSoftWarning: 0,
      isMuted: false,
      toxicMessages: [],
    });
  }
  return userTracker.get(userId);
}

/**
 * Enregistre un message et vérifie les violations.
 * Retourne: { violation: boolean, type: string|null, details: string|null }
 */
function trackMessage(userId, content, channelId) {
  const now = Date.now();
  const userData = getUserData(userId);

  // Decay des strikes si pas d'infraction depuis longtemps
  if (userData.strikes > 0 && now - userData.lastStrike > CONFIG.STRIKE_DECAY) {
    userData.strikes = 0;
  }

  // Ajouter le message
  userData.messages.push({
    timestamp: now,
    content: content.toLowerCase(),
    channelId,
  });

  // Nettoyer les vieux messages (garder seulement ceux dans la fenêtre)
  userData.messages = userData.messages.filter(
    (m) =>
      now - m.timestamp < Math.max(CONFIG.TIME_WINDOW, CONFIG.DUPLICATE_WINDOW),
  );

  // === CHECK 1 : Spam de messages (trop rapide) ===
  const recentMessages = userData.messages.filter(
    (m) => now - m.timestamp < CONFIG.TIME_WINDOW,
  );
  if (recentMessages.length > CONFIG.MESSAGE_LIMIT) {
    return {
      violation: true,
      type: "spam",
      details: `${recentMessages.length} messages en ${CONFIG.TIME_WINDOW / 1000}s`,
    };
  }

  // === CHECK 2 : Messages dupliqués ===
  const recentForDupes = userData.messages.filter(
    (m) => now - m.timestamp < CONFIG.DUPLICATE_WINDOW,
  );
  const contentCount = {};
  for (const msg of recentForDupes) {
    contentCount[msg.content] = (contentCount[msg.content] || 0) + 1;
  }
  const maxDupes = Math.max(...Object.values(contentCount), 0);
  if (maxDupes >= CONFIG.DUPLICATE_LIMIT) {
    return {
      violation: true,
      type: "duplicate",
      details: `Message identique répété ${maxDupes}x`,
    };
  }

  // === CHECK 3 : Contenu toxique ===
  const toxicResult = detectToxicContent(content);
  if (toxicResult.toxic) {
    // 3.a) Si le message est bourré d'insultes à lui seul -> direct
    if (
      toxicResult.words.length >=
      (CONFIG.TOXIC_WORDS_IN_MESSAGE_THRESHOLD || 4)
    ) {
      return {
        violation: true,
        type: "toxic",
        details: "Beaucoup d'insultes dans un seul message",
      };
    }

    // 3.b) Sinon on cumule les insultes sur une petite fenêtre avant d'agir
    if (!Array.isArray(userData.toxicMessages)) {
      userData.toxicMessages = [];
    }

    const windowMs = CONFIG.TOXIC_WINDOW || 20000;
    userData.toxicMessages.push({
      timestamp: now,
      count: toxicResult.words.length,
    });
    userData.toxicMessages = userData.toxicMessages.filter(
      (m) => now - m.timestamp < windowMs,
    );

    const totalWords = userData.toxicMessages.reduce(
      (acc, m) => acc + (m.count || 0),
      0,
    );
    const messageCount = userData.toxicMessages.length;
    const wordsThreshold = CONFIG.TOXIC_THRESHOLD_WORDS || 5;
    const msgThreshold = CONFIG.TOXIC_THRESHOLD_MESSAGES || 3;

    if (totalWords >= wordsThreshold || messageCount >= msgThreshold) {
      return {
        violation: true,
        type: "toxic",
        details: "Beaucoup d'insultes en peu de temps",
      };
    }
  }

  return { violation: false, type: null, details: null };
}

/**
 * Vérifie le spam de mentions dans un message
 */
function checkMentionSpam(message) {
  const mentionCount =
    (message.mentions.users?.size || 0) +
    (message.mentions.roles?.size || 0) +
    (message.mentions.everyone ? 1 : 0);

  if (mentionCount >= CONFIG.MENTION_LIMIT) {
    return {
      violation: true,
      type: "mentions",
      details: `${mentionCount} mentions dans un message`,
    };
  }
  return { violation: false };
}

// ═══════════════════════════════════════════════════════
// SANCTIONS PROGRESSIVES
// ═══════════════════════════════════════════════════════

/**
 * Applique la sanction appropriée selon le nombre de strikes
 */
async function applySanction(message, violationType, details) {
  const userData = getUserData(message.author.id);
  const now = Date.now();

  const isSpamLike =
    violationType === "spam" ||
    violationType === "duplicate" ||
    violationType === "mentions";

  // Étape soft pour le spam : on supprime + petit message, mais SANS strike
  if (isSpamLike && userData.strikes === 0) {
    const softWindow = CONFIG.SOFT_SPAM_WINDOW || 30000;
    if (!userData.lastSoftWarning || now - userData.lastSoftWarning > softWindow) {
      userData.lastSoftWarning = now;

      try {
        // Supprimer le message principal
        await message.delete().catch(() => {});

        // Supprimer quelques messages de spam récents du même user
        if (violationType === "spam" || violationType === "duplicate") {
          await bulkDeleteUserMessages(message.channel, message.author.id, 5);
        }
      } catch (e) {
        // silencieux
      }

      // Message gentil dans le chat
      await message.channel
        .send(`${message.author} moin vite, détend toi`)
        .catch(() => {});

      // Pas de strike, pas de log lourd -> on sort
      return;
    }
  }

  // Éviter de spammer les warnings
  if (
    now - userData.lastWarning < CONFIG.WARNING_COOLDOWN &&
    userData.strikes === userData._lastSanctionStrike
  ) {
    // Juste supprimer le message silencieusement
    try {
      await message.delete();
    } catch (e) {}
    return;
  }

  userData.strikes++;
  userData.lastStrike = now;
  userData.lastWarning = now;
  userData._lastSanctionStrike = userData.strikes;

  // Enregistrer la détection de spam pour la détection de raid
  spamDetections.push({ userId: message.author.id, timestamp: now });

  const member = message.member;
  if (!member) return;

  try {
    // Toujours supprimer le message
    await message.delete().catch(() => {});

    // Essayer de supprimer les messages récents de spam aussi
    if (violationType === "spam" || violationType === "duplicate") {
      await bulkDeleteUserMessages(message.channel, message.author.id, 10);
    }

    if (userData.strikes === 1) {
      // ══ STRIKE 1 : Warning ══
      await applyWarning(message, violationType, details);
    } else if (userData.strikes === 2) {
      // ══ STRIKE 2 : Tempmute ══
      await applyTempmute(message, member, violationType, details);
    } else if (userData.strikes >= 3) {
      // ══ STRIKE 3+ : Soumis ══
      await applySoumis(message, member, violationType, details);
      // Reset les strikes après soumis (sanction max atteinte)
      userData.strikes = 0;
    }
  } catch (error) {
    console.error("[AntiSpam] Erreur lors de la sanction:", error);
  }
}

/**
 * Strike 1 : Warning - Supprime les messages + avertissement
 */
async function applyWarning(message, violationType, details) {
  const typeLabels = {
    spam: "Spam de messages",
    duplicate: "Messages dupliqués",
    toxic: "Contenu inapproprié",
    mentions: "Spam de mentions",
  };

  const warningEmbed = {
    color: 0xffcc00,
    title: "⚠️ Avertissement Anti-Spam",
    description: `${message.author}, ton comportement a été détecté comme du **${typeLabels[violationType] || violationType}**.`,
    fields: [
      { name: "Détail", value: details || "N/A", inline: true },
      { name: "Sanction", value: "Suppression des messages", inline: true },
      { name: "Prochain", value: "⏱️ Tempmute si tu continues", inline: true },
    ],
    footer: { text: "Système Anti-Spam automatique" },
    timestamp: new Date().toISOString(),
  };

  const warning = await message.channel
    .send({ embeds: [warningEmbed] })
    .catch(() => null);
  if (warning) {
    setTimeout(() => warning.delete().catch(() => {}), 10000);
  }

  // Log
  await logModAction(message.guild, {
    action: "ANTISPAM - WARNING",
    moderator: message.client.user,
    target: message.author,
    reason: `${typeLabels[violationType] || violationType} - ${details}`,
    color: 0xffcc00,
  }).catch(() => {});
}

/**
 * Strike 2 : Tempmute - Timeout + rôle Muet
 */
async function applyTempmute(message, member, violationType, details) {
  const durationMs = parseDuration(CONFIG.TEMPMUTE_DURATION);
  if (!durationMs) return;

  const typeLabels = {
    spam: "Spam de messages",
    duplicate: "Messages dupliqués",
    toxic: "Contenu inapproprié",
    mentions: "Spam de mentions",
  };

  try {
    // MP à l'utilisateur
    await message.author
      .send({
        embeds: [
          {
            color: 0xff6600,
            title: "🔇 Tempmute automatique",
            description: `Tu as été mute sur **${message.guild.name}** par le système anti-spam.`,
            fields: [
              {
                name: "Raison",
                value: typeLabels[violationType] || violationType,
                inline: true,
              },
              { name: "Durée", value: CONFIG.TEMPMUTE_DURATION, inline: true },
              {
                name: "Conseil",
                value: "Calme-toi avant de revenir.",
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .catch(() => {});

    // Timeout Discord
    await member.timeout(
      durationMs,
      `[AntiSpam] ${violationType} - ${details}`,
    );

    // Rôle Muet si existant
    const mutedRole = message.guild.roles.cache.find(
      (r) =>
        r.name.toLowerCase() === "muet" || r.name.toLowerCase() === "muted",
    );
    if (mutedRole) {
      await member.roles.add(mutedRole).catch(() => {});
      setTimeout(
        () => member.roles.remove(mutedRole).catch(() => {}),
        durationMs,
      );
    }

    // Enregistrer la sanction
    addSanction(
      message.guild.id,
      message.author.id,
      "tempmute",
      "2",
      "[AntiSpam]",
      `${typeLabels[violationType]} - ${details}`,
      "Spam",
      typeLabels[violationType] || violationType,
      CONFIG.TEMPMUTE_DURATION,
    );

    // Marquer l'utilisateur comme source potentielle de raid
    if (["spam", "duplicate", "toxic", "mentions"].includes(violationType)) {
      const label = typeLabels[violationType] || violationType;
      markRaidSource(
        message.guild.id,
        message.author.id,
        `${label} (Tempmute Anti-Spam)`,
      );
    }

    // Message dans le channel
    const muteEmbed = {
      color: 0xff6600,
      title: "🔇 Tempmute Anti-Spam",
      description: `${message.author} a été **mute ${CONFIG.TEMPMUTE_DURATION}** par le système anti-spam.`,
      fields: [
        {
          name: "Raison",
          value: typeLabels[violationType] || violationType,
          inline: true,
        },
        { name: "Durée", value: CONFIG.TEMPMUTE_DURATION, inline: true },
        { name: "Prochain", value: "🔒 Soumis si ça continue", inline: true },
      ],
      footer: { text: "Système Anti-Spam automatique" },
      timestamp: new Date().toISOString(),
    };

    const muteMsg = await message.channel
      .send({ embeds: [muteEmbed] })
      .catch(() => null);
    if (muteMsg) {
      setTimeout(() => muteMsg.delete().catch(() => {}), 15000);
    }

    // Log modération
    await logModAction(message.guild, {
      action: "ANTISPAM - TEMPMUTE",
      moderator: message.client.user,
      target: message.author,
      reason: `${typeLabels[violationType] || violationType} - ${details}`,
      details: `Durée: ${CONFIG.TEMPMUTE_DURATION}\nStrike: 2/3`,
      color: 0xff6600,
    }).catch(() => {});

    getUserData(message.author.id).isMuted = true;
    setTimeout(() => {
      const ud = userTracker.get(message.author.id);
      if (ud) ud.isMuted = false;
    }, durationMs);
  } catch (error) {
    console.error("[AntiSpam] Erreur tempmute:", error);
  }
}

/**
 * Strike 3 : Soumis - Retire tous les rôles + rôle Soumis
 */
async function applySoumis(message, member, violationType, details) {
  const typeLabels = {
    spam: "Spam de messages",
    duplicate: "Messages dupliqués",
    toxic: "Contenu inapproprié",
    mentions: "Spam de mentions",
  };

  try {
    // Trouver ou créer le rôle soumis
    let soumisRole = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === "soumis",
    );
    if (!soumisRole) {
      soumisRole = await message.guild.roles
        .create({
          name: "soumis",
          color: "#010101",
          permissions: 0n,
          reason: "[AntiSpam] Rôle soumis auto-créé",
        })
        .catch(() => null);
    }
    if (!soumisRole) return;

    // MP à l'utilisateur
    await message.author
      .send({
        embeds: [
          {
            color: 0xff0000,
            title: "🔒 Soumis - Anti-Spam",
            description: `Tu as été **soumis** sur **${message.guild.name}** par le système anti-spam.`,
            fields: [
              {
                name: "Raison",
                value: `${typeLabels[violationType] || violationType} répété`,
                inline: true,
              },
              {
                name: "Conséquence",
                value: "Tous tes rôles ont été retirés",
                inline: true,
              },
              {
                name: "Info",
                value: "Contacte un modérateur pour être désoumis.",
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .catch(() => {});

    // Sauvegarder et retirer les rôles
    const removableRoles = member.roles.cache.filter(
      (r) => r.name !== "@everyone" && !r.managed,
    );
    const roleIds = removableRoles.map((r) => r.id);

    if (roleIds.length > 0) {
      saveUserRoles(message.guild.id, message.author.id, roleIds);
      await member.roles.remove(removableRoles);
    }

    // Ajouter le rôle soumis
    await member.roles.add(soumisRole);

    // Retirer le timeout s'il y en a un (le soumis suffit)
    await member.timeout(null).catch(() => {});

    // Enregistrer la sanction
    addSanction(
      message.guild.id,
      message.author.id,
      "soumis",
      "3",
      "[AntiSpam]",
      `${typeLabels[violationType]} répété - ${details}`,
      "Spam",
      `${typeLabels[violationType]} - Soumis automatique`,
    );

    // Marquer l'utilisateur comme source potentielle de raid
    if (["spam", "duplicate", "toxic", "mentions"].includes(violationType)) {
      const label = typeLabels[violationType] || violationType;
      markRaidSource(
        message.guild.id,
        message.author.id,
        `${label} (Soumis Anti-Spam)`,
      );
    }

    // Message dans le channel
    const soumisEmbed = {
      color: 0xff0000,
      title: "🔒 Soumis - Anti-Spam",
      description: `${message.author} a été **soumis** par le système anti-spam.\nTous ses rôles ont été retirés.`,
      fields: [
        {
          name: "Raison",
          value: `${typeLabels[violationType] || violationType} après avertissements`,
          inline: true,
        },
        { name: "Strikes", value: "3/3 - Sanction maximale", inline: true },
      ],
      footer: { text: "Système Anti-Spam automatique" },
      timestamp: new Date().toISOString(),
    };

    await message.channel.send({ embeds: [soumisEmbed] }).catch(() => null);

    // Log modération
    await logModAction(message.guild, {
      action: "ANTISPAM - SOUMIS",
      moderator: message.client.user,
      target: message.author,
      reason: `${typeLabels[violationType] || violationType} répété - ${details}`,
      details:
        "Strike 3/3 - Sanction maximale automatique\nTous les rôles retirés.",
      color: 0xff0000,
    }).catch(() => {});
  } catch (error) {
    console.error("[AntiSpam] Erreur soumis:", error);
  }
}

// ═══════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════

/**
 * Supprime les messages récents d'un user dans un channel
 */
async function bulkDeleteUserMessages(channel, userId, limit) {
  try {
    const fetched = await channel.messages.fetch({ limit: 50 });
    const userMessages = fetched
      .filter((m) => m.author.id === userId)
      .first(limit);

    if (userMessages.length > 1) {
      await channel.bulkDelete(userMessages, true).catch(() => {
        // Fallback : supprimer un par un si bulkDelete échoue
        userMessages.forEach((m) => m.delete().catch(() => {}));
      });
    }
  } catch (error) {
    // Silencieux - pas grave si ça échoue
  }
}

/**
 * Détecte un raid (plusieurs users déclenchent le spam en même temps)
 */
function detectRaid() {
  const now = Date.now();
  const recentDetections = spamDetections.filter(
    (d) => now - d.timestamp < CONFIG.RAID_WINDOW,
  );

  // Compter les users uniques
  const uniqueUsers = new Set(recentDetections.map((d) => d.userId));
  return uniqueUsers.size >= CONFIG.RAID_THRESHOLD;
}

// ═══════════════════════════════════════════════════════
// ANTI-RAID : SOURCES & INVITES
// ═══════════════════════════════════════════════════════

/**
 * Marque un utilisateur comme source potentielle de raid
 */
function markRaidSource(guildId, userId, reason) {
  const now = Date.now();
  const duration = CONFIG.RAID_SOURCE_DURATION || 2 * 60 * 60 * 1000;

  if (!raidSources.has(guildId)) {
    raidSources.set(guildId, new Map());
  }

  raidSources.get(guildId).set(userId, {
    expiresAt: now + duration,
    reason,
  });
}

/**
 * Rafraîchit le cache d'invites pour un serveur
 */
async function refreshGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach((inv) => {
      map.set(inv.code, inv.uses ?? 0);
    });
    guildInvites.set(guild.id, map);
  } catch (e) {
    // Pas les permissions pour voir les invites, on ignore
  }
}

/**
 * Quand un membre rejoint, tente de savoir par qui il a été invité
 * et applique -soumis automatiquement si l'invitant est une source de raid.
 */
async function handleGuildMemberAdd(member) {
  // On ignore les bots
  if (member.user.bot) return;

  const guild = member.guild;
  if (!guild) return;

  const guildId = guild.id;

  const before = guildInvites.get(guildId) || new Map();

  let usedInvite = null;
  try {
    const invites = await guild.invites.fetch();
    const after = new Map();

    invites.forEach((inv) => {
      const uses = inv.uses ?? 0;
      const prev = before.get(inv.code) ?? 0;
      if (!usedInvite && uses > prev) {
        usedInvite = inv;
      }
      after.set(inv.code, uses);
    });

    // Ne mettre en cache qu’un seul use de plus pour l’invite utilisée, afin que
    // les joins suivants (même invite) voient encore une augmentation et soient détectés.
    if (usedInvite) {
      const prevUsed = before.get(usedInvite.code) ?? 0;
      after.set(usedInvite.code, prevUsed + 1);
    }
    guildInvites.set(guildId, after);
  } catch (e) {
    // Pas de perms ou pas d'invites, on ne peut pas détecter
    return;
  }

  if (!usedInvite || !usedInvite.inviter) return;

  const inviter = usedInvite.inviter;
  const sourcesForGuild = raidSources.get(guildId);
  if (!sourcesForGuild) return;

  const sourceInfo = sourcesForGuild.get(inviter.id);
  if (!sourceInfo) return;

  const now = Date.now();
  if (sourceInfo.expiresAt <= now) {
    // Expiré, on nettoie
    sourcesForGuild.delete(inviter.id);
    if (sourcesForGuild.size === 0) {
      raidSources.delete(guildId);
    }
    return;
  }

  // Ne pas appliquer auto-soumis aux staff (éviter de retirer leurs rôles)
  if (isStaff(member)) return;

  // À ce stade : le membre rejoint via quelqu'un qui a été sanctionné récemment pour spam/insultes.
  await autoSoumisFromRaid(member, inviter, sourceInfo);
}

/**
 * Applique un -soumis automatique à un membre qui rejoint via une source de raid.
 */
async function autoSoumisFromRaid(member, inviter, sourceInfo) {
  const guild = member.guild;

  try {
    // Trouver ou créer le rôle soumis
    let soumisRole = guild.roles.cache.find(
      (r) => r.name.toLowerCase() === "soumis",
    );
    if (!soumisRole) {
      soumisRole = await guild.roles
        .create({
          name: "soumis",
          color: "#010101",
          permissions: 0n,
          reason: "[AntiRaid] Rôle soumis auto-créé",
        })
        .catch(() => null);
    }
    if (!soumisRole) return;

    // Sauvegarder et retirer les rôles actuels (s'il y en a)
    const removableRoles = member.roles.cache.filter(
      (r) => r.name !== "@everyone" && !r.managed,
    );
    const roleIds = removableRoles.map((r) => r.id);

    if (roleIds.length > 0) {
      saveUserRoles(guild.id, member.id, roleIds);
      await member.roles.remove(removableRoles);
    }

    // Ajouter le rôle soumis
    await member.roles.add(soumisRole);

    // Enregistrer la sanction
    addSanction(
      guild.id,
      member.id,
      "soumis",
      "3",
      "[AntiRaid]",
      "Auto-soumis après join via un utilisateur sanctionné Anti-Spam",
      "Spam",
      "Auto-soumis Anti-Raid",
    );

    // DM explicatif à l'utilisateur
    const inviterLabel = inviter.tag
      ? `${inviter.tag} (${inviter.id})`
      : inviter.id;

    await member.user
      .send({
        embeds: [
          {
            color: 0xff0000,
            title: "🔒 Soumis - Protection Anti-Raid",
            description: `Tu as été automatiquement **soumis** sur **${guild.name}**.`,
            fields: [
              {
                name: "Pourquoi ?",
                value:
                  "Tu as rejoint via l'invitation d'une personne qui vient d'être sanctionnée pour **spam / insultes / raid**.",
                inline: false,
              },
              {
                name: "Invitant",
                value: inviterLabel,
                inline: false,
              },
              {
                name: "Que faire si c'est une erreur ?",
                value:
                  "Si tu penses que c'est une erreur, ouvre un **ticket** dans le salon d'aide du serveur pour qu'un staff vérifie ta situation.",
                inline: false,
              },
            ],
            footer: {
              text: "Système Anti-Raid automatique",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .catch(() => {});

    // Log modération
    await logModAction(guild, {
      action: "ANTIRAID - AUTO SOUMIS",
      moderator: guild.client.user,
      target: member.user,
      reason:
        "Rejoint via une personne récemment sanctionnée pour spam / insultes",
      details: `Invitant: ${inviterLabel}\nSource: ${sourceInfo.reason}`,
      color: 0xff0000,
    }).catch(() => {});
  } catch (error) {
    console.error("[AntiRaid] Erreur auto-soumis:", error);
  }
}

/**
 * Vérifie si un member est staff (immunisé)
 */
function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has("Administrator")) return true;

  // Check les rôles staff connus
  const { ROLES } = require("./permHelper");
  return [ROLES.STAFF, ROLES.STAFF_TEST, ROLES.PERM_3, ROLES.PERM_2].some(
    (roleId) => member.roles.cache.has(roleId),
  );
}

// ═══════════════════════════════════════════════════════
// NETTOYAGE MÉMOIRE AUTOMATIQUE
// ═══════════════════════════════════════════════════════

function startCleanupInterval() {
  setInterval(() => {
    const now = Date.now();

    // Nettoyer les utilisateurs inactifs
    for (const [userId, data] of userTracker.entries()) {
      const lastActivity =
        data.messages.length > 0
          ? data.messages[data.messages.length - 1].timestamp
          : data.lastStrike;

      if (now - lastActivity > CONFIG.DATA_EXPIRY && data.strikes === 0) {
        userTracker.delete(userId);
      }

      // Nettoyer les vieux messages
      data.messages = data.messages.filter(
        (m) => now - m.timestamp < CONFIG.DATA_EXPIRY,
      );

      // Nettoyer l'historique des insultes
      if (Array.isArray(data.toxicMessages)) {
        const windowMs = CONFIG.TOXIC_WINDOW || 20000;
        data.toxicMessages = data.toxicMessages.filter(
          (m) => now - m.timestamp < windowMs,
        );
      }
    }

    // Nettoyer les détections de raid anciennes
    const cutoff = now - CONFIG.RAID_WINDOW * 3;
    while (spamDetections.length > 0 && spamDetections[0].timestamp < cutoff) {
      spamDetections.shift();
    }

    // Nettoyer les sources de raid expirées (même sémantique que validation: expiresAt <= now)
    for (const [guildId, sources] of raidSources.entries()) {
      for (const [userId, info] of sources.entries()) {
        if (info.expiresAt <= now) {
          sources.delete(userId);
        }
      }
      if (sources.size === 0) {
        raidSources.delete(guildId);
      }
    }
  }, CONFIG.CLEANUP_INTERVAL);
}

// ═══════════════════════════════════════════════════════
// POINT D'ENTRÉE PRINCIPAL
// ═══════════════════════════════════════════════════════

/**
 * Fonction principale à appeler sur chaque message.
 * Retourne true si le message a été traité (violation détectée).
 */
async function handleMessage(message) {
  // Ignorer les bots
  if (message.author.bot) return false;

  // Ignorer les DMs
  if (!message.guild) return false;

  // Ignorer les staff
  if (isStaff(message.member)) return false;

  // Ignorer si déjà mute (pas besoin de re-sanctionner)
  const userData = getUserData(message.author.id);
  if (userData.isMuted) {
    // Resynchroniser avec Discord : fetch pour avoir l’état réel (unmute par un mod, etc.)
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    const until = member?.communicationDisabledUntilTimestamp ?? null;
    const now = Date.now();
    if (until == null || (typeof until === "number" && until < now)) {
      userData.isMuted = false;
    } else {
      try {
        await message.delete();
      } catch (e) {}
      return true;
    }
  }

  // Check mention spam
  const mentionResult = checkMentionSpam(message);
  if (mentionResult.violation) {
    await applySanction(message, mentionResult.type, mentionResult.details);
    return true;
  }

  // Track le message et vérifier les violations
  const result = trackMessage(
    message.author.id,
    message.content,
    message.channel.id,
  );
  if (result.violation) {
    await applySanction(message, result.type, result.details);

    // Vérifier si c'est un raid
    if (detectRaid()) {
      console.log(
        "[AntiSpam] ⚠️ RAID DÉTECTÉ - Multiples utilisateurs en spam simultané",
      );
      await logModAction(message.guild, {
        action: "ANTISPAM - RAID DÉTECTÉ",
        moderator: message.client.user,
        reason: "Plusieurs utilisateurs spam détectés simultanément",
        details: `${CONFIG.RAID_THRESHOLD}+ utilisateurs en spam dans les ${CONFIG.RAID_WINDOW / 1000} dernières secondes`,
        color: 0xff0000,
      }).catch(() => {});
    }

    return true;
  }

  return false;
}

/**
 * Initialise le système anti-spam (à appeler au démarrage du bot)
 */
function init(client) {
  botUserId = client.user?.id;
  startCleanupInterval();
  // Tracking des invites & auto-soumis anti-raid
  try {
    // Premier remplissage du cache d'invites
    client.guilds.cache.forEach((g) => {
      refreshGuildInvites(g).catch(() => {});
    });

    // Mettre à jour le cache quand une invite est créée / supprimée
    client.on("inviteCreate", (invite) => {
      if (!invite.guild) return;
      const guildId = invite.guild.id;
      if (!guildInvites.has(guildId)) {
        guildInvites.set(guildId, new Map());
      }
      const map = guildInvites.get(guildId);
      map.set(invite.code, invite.uses ?? 0);
    });

    client.on("inviteDelete", (invite) => {
      if (!invite.guild) return;
      const guildId = invite.guild.id;
      const map = guildInvites.get(guildId);
      if (!map) return;
      map.delete(invite.code);
    });

    // Détection des joins suspects
    client.on("guildMemberAdd", (member) => {
      handleGuildMemberAdd(member).catch((e) =>
        console.error("[AntiRaid] Erreur guildMemberAdd:", e),
      );
    });
  } catch (e) {
    console.error("[AntiRaid] Erreur init tracking invites:", e);
  }
  console.log("[AntiSpam] Système initialisé ✓");
}

/**
 * Réinitialise le flag isMuted pour un utilisateur (à appeler quand un mod fait -unmute).
 */
function clearMutedState(userId) {
  const ud = userTracker.get(userId);
  if (ud) ud.isMuted = false;
}

module.exports = {
  handleMessage,
  init,
  clearMutedState,
  CONFIG,
  // Exports pour tests/debug
  normalizeText,
  detectToxicContent,
  userTracker,
};
