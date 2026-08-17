require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const { Telegraf, Markup } = require("telegraf");

const TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "mafia_bot";
const OWNER_ID = String(process.env.OWNER_ID || "");
const PORT = Number(process.env.PORT || 3000);

if (!TOKEN || !MONGO_URI) {
  console.error("BOT_TOKEN va MONGO_URI .env da bo'lishi shart.");
  process.exit(1);
}

const bot = new Telegraf(TOKEN);
const mongo = new MongoClient(MONGO_URI);
let db, users, games, groups;

const timers = new Map();
const sessions = new Map();

const ROLES = {
  DON: "don",
  MAFIA: "mafia",
  CIVILIAN: "civilian",
  COMMISSAR: "commissar",
  DOCTOR: "doctor",
  HOMELESS: "homeless",
  VISITOR: "visitor",
  HACKER: "hacker",
  TRAPPER: "trapper",
  KING: "king",
  KILLER: "killer",
  SERGEANT: "sergeant"
};

const ROLE_INFO = {
  don: ["🤵🏻", "Don", "Mafia"],
  mafia: ["🤵🏻", "Mafiya", "Mafia"],
  civilian: ["👨🏼", "Tinch aholi", "Civilian"],
  commissar: ["🕵🏼", "Komissar", "Civilian"],
  doctor: ["👨🏼‍⚕️", "Doktor", "Civilian"],
  homeless: ["🧙🏼", "Daydi", "Civilian"],
  visitor: ["💃", "Kezuvchi", "Civilian"],
  hacker: ["💻", "Xaker", "Civilian"],
  trapper: ["🪤", "Tuzoqchi", "Civilian"],
  king: ["👑", "Qirol", "Civilian"],
  killer: ["🔪", "Qotil", "Killer"],
  sergeant: ["🎖️", "Serjant", "Civilian"]
};

const texts = {
  uz: {
    choose: "Tilni tanlang:",
    hello: "Salom!\nMen 🤵🏻 Mafia o'yinining rasmiy botiman.",
    add: "➕ Guruhga qo'shish",
    premium: "💎 Premium guruhlar",
    news: "📰 Yangiliklar",
    rules: "📖 O'yin qoidalari",
    back: "↩️ Guruhga qaytish",
    registered: "Ro'yxatdan o'tish boshlandi!\n\nRo'yxatdan o'tganlar:\n",
    joined: "Siz o'yinga omadli qo'shildingiz :)",
    min: "O'yinni boshlash uchun kamida 4 ta o'yinchi kerak.",
    started: "O'yin boshlandi!",
    night: "🌚 🌃 Tun",
    day: "Xayrli tong🌝\n\n🌄 Kun:",
    vote: "Aybdorlarni aniqlash va jazolash vaqti keldi.\nOvoz berish uchun 30 sekund.",
    noGame: "Hozir ro'yxatdan o'tayotgan o'yin yo'q.",
    notPlayer: "Siz bu o'yinda o'yinchi emassiz.",
    profile: "⭐ ID",
    buy: "Nima sotib olamiz?"
  },
  ru: {
    choose: "Выберите язык:",
    hello: "Салом!\nЯ официальный бот игры 🤵🏻 Мафия.",
    add: "➕ Добавить в группу",
    premium: "💎 Премиум группы",
    news: "📰 Новости",
    rules: "📖 Правила игры",
    back: "↩️ В группу",
    registered: "Регистрация началась!\n\nЗарегистрированные:\n",
    joined: "Вы успешно присоединились к игре :)",
    min: "Для начала игры нужно минимум 4 игрока.",
    started: "Игра началась!",
    night: "🌚 🌃 Ночь",
    day: "Доброе утро🌝\n\n🌄 День:",
    vote: "Время определить виновного.\nНа голосование 30 секунд.",
    noGame: "Сейчас нет регистрации.",
    notPlayer: "Вы не игрок этой игры.",
    profile: "⭐ ID",
    buy: "Что купить?"
  },
  en: {
    choose: "Choose a language:",
    hello: "Hello!\nI am the official 🤵🏻 Mafia game bot.",
    add: "➕ Add to group",
    premium: "💎 Premium groups",
    news: "📰 News",
    rules: "📖 Game rules",
    back: "↩️ Back to group",
    registered: "Registration started!\n\nRegistered players:\n",
    joined: "You successfully joined the game :)",
    min: "At least 4 players are required.",
    started: "Game started!",
    night: "🌚 🌃 Night",
    day: "Good morning🌝\n\n🌄 Day:",
    vote: "Time to identify the guilty player.\nVoting: 30 seconds.",
    noGame: "There is no registration in progress.",
    notPlayer: "You are not a player in this game.",
    profile: "⭐ ID",
    buy: "What do you want to buy?"
  }
};

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function esc(s) { return String(s || "").replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&"); }
function lang(ctx) { return ctx.from?.language_code?.startsWith("ru") ? "ru" : "uz"; }
function t(ctx, key) { return texts[lang(ctx)][key] || texts.uz[key] || key; }

function displayName(u) {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return n || u.username || String(u.id);
}

async function ensureUser(tgUser) {
  const id = String(tgUser.id);
  let u = await users.findOne({ _id: id });
  if (!u) {
    u = {
      _id: id,
      id: tgUser.id,
      first_name: tgUser.first_name || "",
      last_name: tgUser.last_name || "",
      username: tgUser.username || "",
      lang: "uz",
      dollar: 0,
      diamond: 0,
      shield: 0,
      killerShield: 0,
      voteShield: 0,
      rifle: 0,
      mask: 0,
      fakeDoc: 0,
      futureRole: null,
      wins: 0,
      games: 0,
      createdAt: new Date()
    };
    await users.insertOne(u);
  } else {
    await users.updateOne({ _id: id }, {
      $set: {
        first_name: tgUser.first_name || u.first_name,
        last_name: tgUser.last_name || u.last_name,
        username: tgUser.username || u.username
      }
    });
    u = await users.findOne({ _id: id });
  }
  return u;
}

function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Guruhga qo'shish", "add_group")],
    [Markup.button.callback("💎 Premium guruhlar", "premium_groups")],
    [Markup.button.callback("📰 Yangiliklar", "news")],
    [Markup.button.callback("📖 O'yin qoidalari", "rules")]
  ]);
}

function privateKeyboard() {
  return Markup.keyboard([
    ["/start", "/til", "/profile"]
  ]).resize();
}

function profileText(u) {
  return `⭐ ID: ${u.id}

👤 ${displayName(u)}

💵 Dollar: ${u.dollar}
💎 Olmos: ${u.diamond}

🛡 Himoya: ${u.shield}
⛑️ Qotildan himoya: ${u.killerShield}
⚖️ Ovoz berishni himoya qilish: ${u.voteShield}
🔫 Miltiq: ${u.rifle}

🎭 Maska: ${u.mask}
📁 Soxta hujjat: ${u.fakeDoc}
🃏 Keyingi o'yindagi rolingiz: ${u.futureRole ? roleName(u.futureRole) : "-"}

🎯 Побед: ${u.wins}
🎲 Всего игр: ${u.games}`;
}

function roleName(role) {
  const x = ROLE_INFO[role];
  return x ? `${x[0]} ${x[1]}` : role;
}
function roleTeam(role) {
  return ROLE_INFO[role]?.[2] || "Civilian";
}
function isMafia(role) { return role === ROLES.DON || role === ROLES.MAFIA; }

function roleText(role) {
  if (role === ROLES.DON) return "Siz - 🤵🏻 Don siz!\nBu tunda kim o'lishini siz hal qilasiz. Siz (Mafialar sardori)siz..";
  if (role === ROLES.MAFIA) return "Siz - 🤵🏻 Mafiyasiz!\nTunda mafiyaga yordam berasiz.";
  if (role === ROLES.COMMISSAR) return "Siz - 🕵🏼 Komissarsiz!\nTunda bir o'yinchining rolini tekshirishingiz mumkin.";
  if (role === ROLES.DOCTOR) return "Siz - 👨🏼‍⚕️️ Doktorsiz!\nTunda bir o'yinchini davolashingiz mumkin.";
  if (role === ROLES.HOMELESS) return "Siz - 🧙🏼 Daydisiz!\nSizning harakatlaringiz o'yin mantiqiga ta'sir qiladi.";
  if (role === ROLES.VISITOR) return "Siz - 💃 Kezuvchisiz!\nTunda bir o'yinchining oldiga borasiz.";
  if (role === ROLES.HACKER) return "Siz - 💻 Xakersiz!\nTunda bir o'yinchining faoliyatini buzishingiz mumkin.";
  if (role === ROLES.TRAPPER) return "Siz - 🪤 Tuzoqchisiz!\nTanlagan joyingizga tuzoq qo'yasiz.";
  if (role === ROLES.KING) return "Siz - 👑 Qirolsiz!\nOvoz berishda kuchli mavqega egasiz.";
  if (role === ROLES.KILLER) return "Siz - 🔪 Qotilsiz!\nTunda bir o'yinchini o'ldirishingiz mumkin.";
  if (role === ROLES.SERGEANT) return "Siz - 🎖️ Serjantsiz!\nKomissarga yordam beruvchi maxsus rol.";
  return "Siz - 👨🏼 Tinch aholisisiz!\nShaharingizni mafiyadan tozalang.";
}

function playersList(g) {
  return g.players.map((p, i) => `${i + 1}. ${displayName(p)}`).join("\n");
}

function alivePlayers(g) { return g.players.filter(p => p.alive); }

function roleStats(g) {
  const counts = {};
  for (const p of g.players) if (p.alive) counts[p.role] = (counts[p.role] || 0) + 1;
  const civilian = Object.entries(counts).filter(([r]) => roleTeam(r) === "Civilian")
    .reduce((a, [,n]) => a+n, 0);
  const mafia = (counts.don || 0) + (counts.mafia || 0);
  return { counts, civilian, mafia };
}

function chooseRoles(n) {
  // Base logic requested: Don + Commissar + Doctor, then civilian fill.
  // Special roles are introduced as the player count grows.
  const roles = [ROLES.DON, ROLES.COMMISSAR, ROLES.DOCTOR];
  if (n >= 5) roles.push(ROLES.MAFIA);
  if (n >= 7) roles.push(ROLES.HOMELESS);
  if (n >= 8) roles.push(ROLES.VISITOR);
  if (n >= 10) roles.push(ROLES.HACKER);
  if (n >= 12) roles.push(ROLES.TRAPPER);
  if (n >= 15) roles.push(ROLES.SERGEANT);
  if (n >= 18) roles.push(ROLES.KING);
  if (n >= 20) roles.push(ROLES.KILLER);

  // Additional mafia every 8 players, without making mafia overwhelm civilians.
  while (roles.filter(isMafia).length < Math.max(1, Math.floor(n / 6))) roles.push(ROLES.MAFIA);

  while (roles.length < n) roles.push(ROLES.CIVILIAN);
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles.slice(0, n);
}

function targetKeyboard(g, filterFn = p => p.alive) {
  const arr = g.players.filter(filterFn);
  return Markup.inlineKeyboard(arr.map(p => [
    Markup.button.callback(displayName(p).slice(0, 30), `act:${g.id}:${p.id}`)
  ]), { columns: 1 });
}

async function sendRoleAction(g, p) {
  try {
    if (!p.alive) return;
    if ([ROLES.DON, ROLES.MAFIA].includes(p.role)) {
      await bot.telegram.sendMessage(p.id, roleText(p.role) + "\n\nNishon tanlang:", targetKeyboard(g, x => x.alive && x.id !== p.id));
    } else if ([ROLES.COMMISSAR, ROLES.DOCTOR, ROLES.VISITOR, ROLES.HACKER, ROLES.TRAPPER, ROLES.KILLER].includes(p.role)) {
      await bot.telegram.sendMessage(p.id, roleText(p.role) + "\n\nNishon tanlang:", targetKeyboard(g, x => x.alive && x.id !== p.id));
    } else {
      await bot.telegram.sendMessage(p.id, roleText(p.role) + "\n\nBu tunda sizning maxsus harakatingiz yo'q.");
    }
  } catch {}
}

function cancelTimer(key) {
  const x = timers.get(key);
  if (x) clearTimeout(x);
  timers.delete(key);
}

function setTimer(key, ms, fn) {
  cancelTimer(key);
  const x = setTimeout(fn, ms);
  timers.set(key, x);
}

async function saveGame(g) {
  await games.updateOne({ _id: g.id }, { $set: g }, { upsert: true });
}

async function getGame(chatId) {
  return games.findOne({ chatId: Number(chatId), active: true });
}

async function registrationMessage(g) {
  return `Ro'yxatdan o'tish boshlandi

Ro'yxatdan o'tish davom etmoqda
Ro'yxatdan o'tganlar:
${playersList(g)}

Jami: ${g.players.length} ta odam.`;
}

async function refreshRegistration(g) {
  if (!g.registrationMessageId) return;
  try {
    await bot.telegram.editMessageText(
      g.chatId,
      g.registrationMessageId,
      undefined,
      await registrationMessage(g),
      Markup.inlineKeyboard([[Markup.button.callback("🎮 O'yinga qo'shilish", `join:${g.id}`)]])
    );
  } catch {}
}

async function createGame(ctx) {
  const chatId = ctx.chat.id;
  let old = await getGame(chatId);
  if (old) return ctx.reply("Bu guruhda allaqachon o'yin bor.");

  const g = {
    _id: uid(),
    id: uid(),
    chatId,
    title: ctx.chat.title || "",
    phase: "registration",
    active: true,
    day: 0,
    createdAt: new Date(),
    players: [],
    actions: {},
    votes: {},
    dayVotes: {},
    settings: {
      registrationSeconds: 120,
      nightSeconds: 45,
      daySeconds: 15,
      voteSeconds: 30,
      autoDeleteMessages: true
    },
    registrationMessageId: null,
    startedAt: null
  };
  await games.insertOne(g);
  const msg = await ctx.reply(
    await registrationMessage(g),
    Markup.inlineKeyboard([[Markup.button.callback("🎮 O'yinga qo'shilish", `join:${g.id}`)]])
  );
  g.registrationMessageId = msg.message_id;
  await saveGame(g);

  setTimer(`reg:${g.id}`, g.settings.registrationSeconds * 1000, async () => {
    const cur = await games.findOne({ _id: g.id });
    if (!cur || !cur.active || cur.phase !== "registration") return;
    if (cur.players.length >= 4) {
      await startGame(cur);
    } else {
      cur.active = false;
      await saveGame(cur);
      try { await bot.telegram.editMessageText(cur.chatId, cur.registrationMessageId, undefined, "⏱ Ro'yxatdan o'tish vaqti tugadi. Kamida 4 o'yinchi kerak."); } catch {}
    }
  });
}

async function joinGame(ctx, gid) {
  const g = await games.findOne({ _id: gid });
  if (!g || !g.active || g.phase !== "registration") return ctx.answerCbQuery("Ro'yxatdan o'tish yopilgan.");
  const u = await ensureUser(ctx.from);
  if (g.players.some(p => p.id === u.id)) return ctx.answerCbQuery("Siz allaqachon qo'shilgansiz.");

  if (g.players.length >= 30) return ctx.answerCbQuery("Maksimal 30 o'yinchi.");
  g.players.push({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    username: u.username,
    role: null,
    alive: true,
    joinedAt: new Date(),
    protected: false,
    killerProtected: false,
    blocked: false,
    lastAction: null
  });
  await saveGame(g);
  await ctx.answerCbQuery("Siz o'yinga omadli qo'shildingiz :)");
  try {
    await ctx.reply(t(ctx, "joined"), Markup.inlineKeyboard([[Markup.button.callback(t(ctx, "back"), `backgroup:${g.chatId}`)]]));
  } catch {}
  await refreshRegistration(g);
}

async function startGame(g) {
  cancelTimer(`reg:${g.id}`);
  if (g.players.length < 4) return;
  g.phase = "night";
  g.day = 0;
  g.startedAt = new Date();
  g.actions = {};
  g.votes = {};
  const roles = chooseRoles(g.players.length);
  for (let i = 0; i < g.players.length; i++) {
    const p = g.players[i];
    p.role = p.role || roles[i];
    p.alive = true;
    p.protected = false;
    p.killerProtected = false;
    p.blocked = false;
    const u = await users.findOne({ _id: String(p.id) });
    if (u?.futureRole) {
      // A purchased future role is used only if that role exists in the current role pool.
      // It replaces a random civilian where possible.
      const idx = g.players.findIndex(x => x.role === u.futureRole);
      if (idx >= 0) {
        p.role = u.futureRole;
        await users.updateOne({ _id: String(p.id) }, { $set: { futureRole: null } });
      }
    }
  }
  await saveGame(g);

  await bot.telegram.sendMessage(g.chatId, `O'yin boshlandi!\n\n${aliveBlock(g)}`);
  for (const p of g.players) {
    try { await bot.telegram.sendMessage(p.id, roleText(p.role)); } catch {}
  }
  await startNight(g);
}

function aliveBlock(g) {
  const list = alivePlayers(g).map((p, i) => `${i + 1}. ${displayName(p)}`).join("\n");
  const st = roleStats(g);
  return `Tirik o'yinchilar:\n${list}\n\n🏘 Tinch aholilar - ${st.civilian}\n🤵🏻 Mafiya - ${st.mafia}\n\nJami: ${alivePlayers(g).length}`;
}

async function startNight(g) {
  if (!g.active) return;
  g.phase = "night";
  g.actions = {};
  g.votes = {};
  for (const p of g.players) {
    p.blocked = false;
    p.protected = false;
    p.killerProtected = false;
  }
  await saveGame(g);
  await bot.telegram.sendMessage(g.chatId, `🌚 🌃Tun\nKo'chaga faqat jasur va qo'rqmas odamlar chiqishdi. Ertalab tirik qolganlarni sanaymiz...`);
  for (const p of alivePlayers(g)) await sendRoleAction(g, p);
  setTimer(`night:${g.id}`, g.settings.nightSeconds * 1000, () => finishNight(g.id));
}

async function finishNight(gid) {
  cancelTimer(`night:${gid}`);
  const g = await games.findOne({ _id: gid });
  if (!g || !g.active || g.phase !== "night") return;

  const actions = g.actions || {};
  const byRole = role => g.players.find(p => p.alive && p.role === role);
  const targetOf = role => {
    const p = byRole(role);
    return p && actions[p.id] ? Number(actions[p.id]) : null;
  };

  // Visitor blocks the target's night action.
  const visitor = byRole(ROLES.VISITOR);
  if (visitor && actions[visitor.id]) {
    const t = g.players.find(p => p.id === Number(actions[visitor.id]) && p.alive);
    if (t) t.blocked = true;
  }

  // Doctor protects.
  const doctor = byRole(ROLES.DOCTOR);
  if (doctor && !doctor.blocked && actions[doctor.id]) {
    const t = g.players.find(p => p.id === Number(actions[doctor.id]) && p.alive);
    if (t) t.protected = true;
  }

  // Killer protection item is consumed automatically if the killer attacks that player.
  const killer = byRole(ROLES.KILLER);
  let killTarget = null;
  if (killer && !killer.blocked && actions[killer.id]) killTarget = Number(actions[killer.id]);

  // Don + mafia choose the same target; Don wins tie.
  const don = byRole(ROLES.DON);
  let mafiaTarget = don && !don.blocked ? Number(actions[don.id]) : null;
  if (!mafiaTarget) {
    const mf = g.players.find(p => p.alive && p.role === ROLES.MAFIA && !p.blocked && actions[p.id]);
    if (mf) mafiaTarget = Number(actions[mf.id]);
  }

  const victims = [];
  const addKill = async (targetId, source) => {
    if (!targetId) return;
    const target = g.players.find(p => p.id === targetId && p.alive);
    if (!target) return;
    const u = await users.findOne({ _id: String(target.id) });
    if (source === "killer" && u?.killerShield > 0) {
      await users.updateOne({ _id: String(target.id) }, { $inc: { killerShield: -1 } });
      await bot.telegram.sendMessage(g.chatId, `⛑️ ${displayName(target)} qotildan himoya vositasini ishlatdi.`);
      return;
    }
    if (target.protected || u?.shield > 0) {
      if (u?.shield > 0) await users.updateOne({ _id: String(target.id) }, { $inc: { shield: -1 } });
      target.protected = false;
      await bot.telegram.sendMessage(g.chatId, `🛡️ ${displayName(target)} himoyasini ishlatdi.`);
      return;
    }
    if (!victims.some(v => v.id === target.id)) victims.push(target);
  };

  await addKill(mafiaTarget, "mafia");
  await addKill(killTarget, "killer");

  for (const v of victims) v.alive = false;

  // Commissar check.
  const comm = byRole(ROLES.COMMISSAR);
  if (comm && !comm.blocked && actions[comm.id]) {
    const target = g.players.find(p => p.id === Number(actions[comm.id]));
    if (target) {
      const u = await users.findOne({ _id: String(target.id) });
      const revealed = u?.fakeDoc > 0 && !target.role.startsWith("mafia") && target.role !== ROLES.DON ? ROLES.CIVILIAN : target.role;
      try {
        await bot.telegram.sendMessage(comm.id, `🕵🏼 Tekshiruv natijasi:\n${displayName(target)} — ${roleName(revealed)}`);
      } catch {}
    }
  }

  await saveGame(g);

  if (victims.length) {
    for (const v of victims) {
      try { await bot.telegram.sendMessage(v.id, `Sizni shafqatsizlarcha o'ldirishdi :(\nSo'nggi so'zingizni aytishingiz mumkin.`); } catch {}
    }
    await bot.telegram.sendMessage(g.chatId, victims.map(v => `💀 ${displayName(v)} tunda o'ldirildi. Uning roli: ${roleName(v.role)}`).join("\n"));
  } else {
    await bot.telegram.sendMessage(g.chatId, "🌙 Bu tunda hech kim halok bo'lmadi.");
  }

  if (await checkWin(g)) return;
  await startDay(g);
}

async function startDay(g) {
  g.phase = "day";
  g.day += 1;
  g.votes = {};
  await saveGame(g);
  await bot.telegram.sendMessage(g.chatId, `Xayrli tong🌝\n\n🌄Kun: ${g.day}\nShamollar tundagi mish-mishlarni butun shaharga yetkazmoqda..\n\n${aliveBlock(g)}`);
  setTimer(`day:${g.id}`, g.settings.daySeconds * 1000, () => startVoting(g.id));
}

async function startVoting(gid) {
  cancelTimer(`day:${gid}`);
  const g = await games.findOne({ _id: gid });
  if (!g || !g.active || g.phase !== "day") return;
  g.phase = "vote";
  g.votes = {};
  await saveGame(g);
  await bot.telegram.sendMessage(g.chatId,
    `Aybdorlarni aniqlash va jazolash vaqti keldi.\nOvoz berish uchun ${g.settings.voteSeconds} sekund.`,
    Markup.inlineKeyboard([[Markup.button.callback("🗳 Ovoz berish", `vote_open:${g.id}`)]])
  );
  setTimer(`vote:${g.id}`, g.settings.voteSeconds * 1000, () => finishVoting(g.id));
}

function voteKeyboard(g) {
  return Markup.inlineKeyboard(alivePlayers(g).map(p => [
    Markup.button.callback(displayName(p).slice(0, 30), `vote:${g.id}:${p.id}`)
  ]), { columns: 1 });
}

async function finishVoting(gid) {
  cancelTimer(`vote:${gid}`);
  const g = await games.findOne({ _id: gid });
  if (!g || !g.active || g.phase !== "vote") return;

  const counts = {};
  for (const target of Object.values(g.votes || {})) counts[target] = (counts[target] || 0) + 1;
  const ranked = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  if (!ranked.length) {
    await bot.telegram.sendMessage(g.chatId, "Ovoz berilmadi. Hech kim osilmadi.");
  } else if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
    await bot.telegram.sendMessage(g.chatId, `Ovozlar teng: ${ranked[0][1]}-${ranked[1][1]}. Odamlar kelisha olmadi, hech kim osilmadi.`);
  } else {
    const target = g.players.find(p => p.id === Number(ranked[0][0]) && p.alive);
    if (target) {
      const u = await users.findOne({ _id: String(target.id) });
      if (u?.voteShield > 0) {
        await users.updateOne({ _id: String(target.id) }, { $inc: { voteShield: -1 } });
        await bot.telegram.sendMessage(g.chatId, `⚖️ ${displayName(target)} ovoz berishdan himoyasini ishlatdi. U osilmadi.`);
      } else {
        target.alive = false;
        await saveGame(g);
        await bot.telegram.sendMessage(g.chatId,
          `Ovoz berish natijalari:\n${ranked.map(([id,n]) => `${displayName(g.players.find(p=>p.id===Number(id)))} — ${n}`).join("\n")}\n\n${displayName(target)} o'tkazilgan kunduzgi yig'ilishda osildi!\nU edi ${roleName(target.role)}.`);
        try { await bot.telegram.sendMessage(target.id, `Sizni ovoz berish orqali o'yindan chiqarishdi.\nSiz ${roleName(target.role)} edingiz.`); } catch {}
      }
    }
  }

  if (await checkWin(g)) return;
  await startNight(g);
}

async function checkWin(g) {
  const st = roleStats(g);
  const mafia = g.players.filter(p => p.alive && isMafia(p.role));
  const civilians = g.players.filter(p => p.alive && !isMafia(p.role) && p.role !== ROLES.KILLER);
  const killer = g.players.some(p => p.alive && p.role === ROLES.KILLER);

  let winner = null;
  if (mafia.length === 0) winner = "civilian";
  else if (mafia.length >= civilians.length && civilians.length > 0) winner = "mafia";
  else if (mafia.length === 0 && killer) winner = "killer";

  if (!winner) return false;
  await finishGame(g, winner);
  return true;
}

async function finishGame(g, winner) {
  g.active = false;
  g.phase = "finished";
  cancelTimer(`reg:${g.id}`); cancelTimer(`night:${g.id}`); cancelTimer(`day:${g.id}`); cancelTimer(`vote:${g.id}`);
  await saveGame(g);

  const winnerPlayers = g.players.filter(p => {
    if (winner === "mafia") return isMafia(p.role);
    if (winner === "killer") return p.role === ROLES.KILLER;
    return !isMafia(p.role) && p.role !== ROLES.KILLER;
  });
  const winners = winnerPlayers.map(p => displayName(p)).join("\n");
  const losers = g.players.filter(p => !winnerPlayers.some(w => w.id === p.id)).map(p => displayName(p)).join("\n");

  await bot.telegram.sendMessage(g.chatId,
    `O'yin tugadi!\n\nG'oliblar:\n${winners || "-"}\n\nQolgan o'yinchilar:\n${losers || "-"}\n\nO'yin yakunlandi.`);
  for (const p of g.players) {
    await users.updateOne({ _id: String(p.id) }, {
      $inc: { games: 1, ...(winnerPlayers.some(w => w.id === p.id) ? { wins: 1, dollar: 30 } : {}) }
    });
    try {
      const u = await users.findOne({ _id: String(p.id) });
      await bot.telegram.sendMessage(p.id,
        winnerPlayers.some(w => w.id === p.id)
          ? `Siz yutdingiz!\nYutganingiz uchun sizga 💵 30, 💎 0 berildi!\n\n${profileText(u)}`
          : `Siz yutqazdingiz.\n\n${profileText(u)}`,
        Markup.keyboard([
          ["🛒 Do'kon", "💎 Xarid qilish"],
          ["📰 Yangiliklar", "🆘 Support"]
        ]).resize()
      );
    } catch {}
  }
}

async function isGroupAdmin(ctx) {
  if (!ctx.chat || !["group", "supergroup"].includes(ctx.chat.type)) return false;
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return ["creator", "administrator"].includes(m.status);
  } catch { return false; }
}

async function hasBotAdmin(ctx) {
  try {
    const m = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    return ["creator", "administrator"].includes(m.status);
  } catch { return false; }
}

async function requireAdmin(ctx) {
  if (!(await isGroupAdmin(ctx))) {
    await ctx.reply("Bu buyruq faqat guruh administratori uchun.");
    return false;
  }
  return true;
}

bot.start(async ctx => {
  await ensureUser(ctx.from);
  await ctx.reply("Выберите язык / Tilni tanlang / Choose language", Markup.inlineKeyboard([
    [Markup.button.callback("🇺🇿 Uzb", "lang:uz"), Markup.button.callback("🇷🇺 Rus", "lang:ru"), Markup.button.callback("🇬🇧 English", "lang:en")]
  ]));
});

bot.command("til", async ctx => {
  await ctx.reply("Tilni tanlang:", Markup.inlineKeyboard([
    [Markup.button.callback("🇺🇿 Uzb", "lang:uz"), Markup.button.callback("🇷🇺 Rus", "lang:ru"), Markup.button.callback("🇬🇧 English", "lang:en")]
  ]));
});

bot.action(/^lang:(uz|ru|en)$/, async ctx => {
  const l = ctx.match[1];
  await ensureUser(ctx.from);
  await users.updateOne({ _id: String(ctx.from.id) }, { $set: { lang: l } });
  await ctx.answerCbQuery();
  await ctx.editMessageText(texts[l].hello, mainKeyboard());
  await ctx.reply("Menyu:", privateKeyboard());
});

bot.command("profile", async ctx => {
  const u = await ensureUser(ctx.from);
  await ctx.reply(profileText(u), Markup.inlineKeyboard([
    [Markup.button.callback("📁 Soxta hujjat ON/OFF", "toggle:fakeDoc")],
    [Markup.button.callback("🛡 Himoya ON/OFF", "toggle:shield")],
    [Markup.button.callback("🎭 Maska ON/OFF", "toggle:mask")],
    [Markup.button.callback("🔫 Miltiq ON/OFF", "toggle:rifle")],
    [Markup.button.callback("⛑️ Qotildan himoya ON/OFF", "toggle:killerShield")],
    [Markup.button.callback("⚖️ Ovoz himoyasi ON/OFF", "toggle:voteShield")],
    [Markup.button.callback("🛒 Do'kon", "shop")]
  ]));
});

bot.action(/^toggle:(fakeDoc|shield|mask|rifle|killerShield|voteShield)$/, async ctx => {
  const field = ctx.match[1];
  const u = await ensureUser(ctx.from);
  const val = Number(u[field] || 0);
  if (val <= 0) return ctx.answerCbQuery("Bu buyum sizda yo'q.");
  const sessionKey = `${ctx.from.id}:toggle`;
  sessions.set(sessionKey, { field, until: Date.now() + 60000 });
  await ctx.answerCbQuery();
  await ctx.reply(`${field} hozir mavjud: ${val}. ON/OFF holatini keyingi o'yin oldidan boshqarishingiz mumkin.`);
});

bot.action("add_group", async ctx => {
  await ctx.answerCbQuery();
  const me = await ctx.telegram.getMe();
  await ctx.reply("Botni guruhga qo'shing:", Markup.inlineKeyboard([
    [Markup.button.url("➕ Guruhga qo'shish", `https://t.me/${me.username}?startgroup=true`)]
  ]));
});
bot.action("premium_groups", async ctx => ctx.answerCbQuery("Premium guruhlar tez orada."));
bot.action("news", async ctx => ctx.answerCbQuery("Yangiliklar bo'limi."));
bot.action("rules", async ctx => {
  await ctx.answerCbQuery();
  await ctx.reply(`📖 Mafia qoidalari

1. /game — ro'yxatdan o'tish.
2. /start — guruhdagi o'yinni boshlash.
3. Har guruhning o'yini alohida ID bilan saqlanadi.
4. Minimum 4, maksimum 30 o'yinchi.
5. Tunda rollar maxsus harakat qiladi.
6. Kunduzi ovoz beriladi.
7. Mafia yo'q qilinsa — tinch aholi yutadi.
8. Mafia soni tinch aholiga tenglashsa — mafia yutadi.
9. O'yin vaqtida ro'yxatda bo'lmagan odamlarning xabarlari avtomatik o'chirilishi mumkin.`);
});

bot.command("game", async ctx => {
  if (!["group", "supergroup"].includes(ctx.chat.type)) return ctx.reply("Bu buyruqni guruhda ishlating.");
  if (!(await hasBotAdmin(ctx))) return ctx.reply("Botga admin huquqi bering. Xabarlarni o'chirish huquqi ham kerak.");
  if (!(await requireAdmin(ctx))) return;
  await createGame(ctx);
});

bot.command("start", async ctx => {
  if (!["group", "supergroup"].includes(ctx.chat.type)) return;
  if (!(await requireAdmin(ctx))) return;
  const g = await getGame(ctx.chat.id);
  if (!g || g.phase !== "registration") return ctx.reply(t(ctx, "noGame"));
  if (g.players.length < 4) return ctx.reply(t(ctx, "min"));
  await startGame(g);
});

bot.command("stop", async ctx => {
  if (!(await requireAdmin(ctx))) return;
  const g = await getGame(ctx.chat.id);
  if (!g) return ctx.reply("Faol o'yin yo'q.");
  g.active = false; g.phase = "stopped";
  await saveGame(g);
  cancelTimer(`reg:${g.id}`); cancelTimer(`night:${g.id}`); cancelTimer(`day:${g.id}`); cancelTimer(`vote:${g.id}`);
  await ctx.reply("🛑 O'yin to'xtatildi.");
});

bot.command("kik", async ctx => {
  if (!(await requireAdmin(ctx))) return;
  const g = await getGame(ctx.chat.id);
  if (!g || g.phase !== "registration") return ctx.reply("Faqat ro'yxatdan o'tish paytida ishlaydi.");
  const targetId = Number((ctx.message.text || "").split(/\s+/)[1]);
  if (!targetId) return ctx.reply("/kik USER_ID");
  const before = g.players.length;
  g.players = g.players.filter(p => p.id !== targetId);
  await saveGame(g);
  await refreshRegistration(g);
  ctx.reply(before !== g.players.length ? "O'yinchi chiqarildi." : "O'yinchi topilmadi.");
});

bot.command("vaqt", async ctx => {
  if (!(await requireAdmin(ctx))) return;
  const g = await getGame(ctx.chat.id);
  if (!g) return ctx.reply("Faol o'yin yo'q.");
  const sec = Number((ctx.message.text || "").split(/\s+/)[1]);
  if (!Number.isFinite(sec) || sec < 10 || sec > 600) return ctx.reply("/vaqt 120");
  g.settings.registrationSeconds = sec;
  await saveGame(g);
  ctx.reply(`Ro'yxatdan o'tish vaqti ${sec} sekundga o'zgartirildi.`);
});

bot.command("top", async ctx => {
  const top = await users.find({}).sort({ wins: -1 }).limit(10).toArray();
  await ctx.reply("🏆 TOP:\n\n" + top.map((u,i)=>`${i+1}. ${displayName(u)} — ${u.wins} g'alaba`).join("\n"));
});

bot.command("settings", async ctx => {
  if (!(await requireAdmin(ctx))) return;
  const g = await getGame(ctx.chat.id);
  await ctx.reply(g ? `⚙️ Settings\nRo'yxat: ${g.settings.registrationSeconds}s\nTun: ${g.settings.nightSeconds}s\nKun: ${g.settings.daySeconds}s\nVote: ${g.settings.voteSeconds}s` : "Avval /game.");
});

bot.action(/^join:(.+)$/, async ctx => joinGame(ctx, ctx.match[1]));
bot.action(/^backgroup:(-?\d+)$/, async ctx => {
  await ctx.answerCbQuery();
  await ctx.reply("Guruhga qaytish tugmasi.");
});

bot.action(/^vote_open:(.+)$/, async ctx => {
  const g = await games.findOne({ _id: ctx.match[1] });
  if (!g || !g.active || g.phase !== "vote") return ctx.answerCbQuery("Ovoz berish yopilgan.");
  await ctx.answerCbQuery();
  await ctx.reply("Aybdorlarni aniqlash va jazolash vaqti keldi!\nKimni osish kerak deb hisoblaysiz?", voteKeyboard(g));
});

bot.action(/^vote:(.+):(\d+)$/, async ctx => {
  const g = await games.findOne({ _id: ctx.match[1] });
  if (!g || !g.active || g.phase !== "vote") return ctx.answerCbQuery("Ovoz berish tugagan.");
  const voter = g.players.find(p => p.id === ctx.from.id && p.alive);
  const target = g.players.find(p => p.id === Number(ctx.match[2]) && p.alive);
  if (!voter) return ctx.answerCbQuery("Siz tirik o'yinchi emassiz.");
  if (!target) return ctx.answerCbQuery("Bu o'yinchi yo'q.");
  g.votes[String(voter.id)] = target.id;
  await saveGame(g);
  await ctx.answerCbQuery(`Siz ${displayName(target)} ni tanladingiz.`);
  try { await ctx.telegram.sendMessage(g.chatId, `${displayName(voter)} -- ${displayName(target)} ga ovoz berdi`); } catch {}
});

bot.action(/^act:(.+):(\d+)$/, async ctx => {
  const g = await games.findOne({ _id: ctx.match[1] });
  if (!g || !g.active || g.phase !== "night") return ctx.answerCbQuery("Tun tugagan.");
  const actor = g.players.find(p => p.id === ctx.from.id && p.alive);
  const target = g.players.find(p => p.id === Number(ctx.match[2]) && p.alive);
  if (!actor) return ctx.answerCbQuery("Siz tirik o'yinchi emassiz.");
  if (!target) return ctx.answerCbQuery("Nishon topilmadi.");
  g.actions[String(actor.id)] = target.id;
  await saveGame(g);
  await ctx.answerCbQuery(`Siz ${displayName(target)} ni tanladingiz.`);
  await ctx.reply(`Siz - ${displayName(target)} ni tanladingiz.`, Markup.inlineKeyboard([
    [Markup.button.url("➡️ Guruhga o'tish", `https://t.me/c/${String(g.chatId).replace("-100","")}/${g.registrationMessageId || ""}`)]
  ]));
});

bot.hears(["🛒 Do'kon", "💎 Xarid qilish"], async ctx => {
  await ensureUser(ctx.from);
  await ctx.reply(t(ctx, "buy"), Markup.inlineKeyboard([
    [Markup.button.callback("📁 Hujjatlar — 1💎", "buy:fakeDoc")],
    [Markup.button.callback("🛡 Himoya — 1💎", "buy:shield")],
    [Markup.button.callback("🎭 Maska — 1💎", "buy:mask")],
    [Markup.button.callback("🔫 Miltiq — 2💎", "buy:rifle")],
    [Markup.button.callback("⛑️ Qotildan himoya — 2💎", "buy:killerShield")],
    [Markup.button.callback("⚖️ Ovoz himoyasi — 2💎", "buy:voteShield")],
    [Markup.button.callback("🃏 Faol rol — 5💎", "buy:futureRole")]
  ]));
});

bot.action("shop", async ctx => {
  await ctx.answerCbQuery();
  await ctx.reply(t(ctx, "buy"), Markup.inlineKeyboard([
    [Markup.button.callback("📁 Hujjatlar — 1💎", "buy:fakeDoc")],
    [Markup.button.callback("🛡 Himoya — 1💎", "buy:shield")],
    [Markup.button.callback("🎭 Maska — 1💎", "buy:mask")],
    [Markup.button.callback("🔫 Miltiq — 2💎", "buy:rifle")],
    [Markup.button.callback("⛑️ Qotildan himoya — 2💎", "buy:killerShield")],
    [Markup.button.callback("⚖️ Ovoz himoyasi — 2💎", "buy:voteShield")],
    [Markup.button.callback("🃏 Faol rol — 5💎", "buy:futureRole")]
  ]));
});

bot.action(/^buy:(fakeDoc|shield|mask|rifle|killerShield|voteShield|futureRole)$/, async ctx => {
  const item = ctx.match[1];
  const cost = item === "futureRole" ? 5 : ["rifle","killerShield","voteShield"].includes(item) ? 2 : 1;
  const u = await ensureUser(ctx.from);
  if (u.diamond < cost) return ctx.answerCbQuery("Olmos yetarli emas.");
  if (item === "futureRole") {
    await ctx.answerCbQuery();
    await ctx.reply("Keyingi o'yin uchun rol tanlang:", Markup.inlineKeyboard([
      [Markup.button.callback("🤵🏻 Mafia", "future:mafia"), Markup.button.callback("🕵🏼 Komissar", "future:commissar")],
      [Markup.button.callback("👨🏼‍⚕️ Doktor", "future:doctor"), Markup.button.callback("💃 Kezuvchi", "future:visitor")],
      [Markup.button.callback("💻 Xaker", "future:hacker"), Markup.button.callback("🪤 Tuzoqchi", "future:trapper")],
      [Markup.button.callback("🔪 Qotil", "future:killer"), Markup.button.callback("🎖️ Serjant", "future:sergeant")]
    ]));
    return;
  }
  await users.updateOne({ _id: String(ctx.from.id) }, { $inc: { diamond: -cost, [item]: 1 } });
  await ctx.answerCbQuery("Sotib olindi.");
  await ctx.reply(`✅ ${roleName(item)} emas, buyum sotib olindi. Profilingiz yangilandi.`);
});

bot.action(/^future:(mafia|commissar|doctor|visitor|hacker|trapper|killer|sergeant)$/, async ctx => {
  const role = ctx.match[1];
  const u = await ensureUser(ctx.from);
  if (u.diamond < 5) return ctx.answerCbQuery("Olmos yetarli emas.");
  await users.updateOne({ _id: String(ctx.from.id) }, { $inc: { diamond: -5 }, $set: { futureRole: role } });
  await ctx.answerCbQuery("Keyingi o'yin uchun rol saqlandi.");
  await ctx.reply(`🃏 Keyingi o'yindagi rolingiz: ${roleName(role)}`);
});

bot.command("give", async ctx => {
  if (String(ctx.from.id) !== OWNER_ID) return;
  const [, id, amount] = (ctx.message.text || "").split(/\s+/);
  if (!id || !amount) return ctx.reply("/give USER_ID 100");
  await users.updateOne({ _id: String(id) }, { $inc: { diamond: Number(amount) } }, { upsert: true });
  ctx.reply(`💎 ${amount} olmos ${id} ga berildi.`);
});

bot.command("givedo", async ctx => {
  if (String(ctx.from.id) !== OWNER_ID) return;
  const [, id, amount] = (ctx.message.text || "").split(/\s+/);
  if (!id || !amount) return ctx.reply("/givedo USER_ID 100");
  await users.updateOne({ _id: String(id) }, { $inc: { dollar: Number(amount) } }, { upsert: true });
  ctx.reply(`💵 ${amount} dollar ${id} ga berildi.`);
});

// Delete non-player messages during an active game.
// Bot needs Delete Messages admin permission.
bot.on("message", async ctx => {
  if (!ctx.chat || !["group","supergroup"].includes(ctx.chat.type)) return;
  const g = await getGame(ctx.chat.id);
  if (!g || !g.active || !g.settings.autoDeleteMessages) return;
  const player = g.players.find(p => p.id === ctx.from.id);
  if (!player && ctx.message?.message_id) {
    try { await ctx.deleteMessage(); } catch {}
  }
});

bot.catch(err => console.error("BOT ERROR:", err));

async function main() {
  await mongo.connect();
  db = mongo.db(DB_NAME);
  users = db.collection("users");
  games = db.collection("games");
  groups = db.collection("groups");

  await users.createIndex({ wins: -1 });
  await games.createIndex({ chatId: 1, active: 1 });

  const app = express();
  app.get("/", (_, res) => res.status(200).send("Mafia bot is running."));
  app.get("/health", (_, res) => res.json({ ok: true, service: "mafia-bot" }));
  app.listen(PORT, () => console.log(`HTTP server :${PORT}`));

  await bot.launch();
  console.log("Telegram bot started.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
