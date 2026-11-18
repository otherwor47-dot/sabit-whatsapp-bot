import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';

const BOT_NAME = "⦿ —͞𐋄 Ꮥꫝ֟፝ᏰᎥᏖ øᎮ";
const OWNER_NAME = "Ꮥꫝ֟፝ᏰᎥᏖ øᎮ";
const DEVELOPER = "ᥫ᭡⊶ֆɨɢʍǟ ɮ፝֟፝֟օʏ々";
const OWNER_DM = "https://t.me/Sabitopp";
const PAIR_LINK = "https://t.me/sabitopbot";
const SESSION_DIR = './database/session';
const logger = pino({ level: 'silent' });

let botMode = "public"; 
let antiCallActive = false;
let antiLinkActive = false;
let antiGcStatusActive = false;
let antiGcStatusMode = "delete";

// Catbox.moe এর হাই-স্পিড ও স্ট্যাবল ডাইরেক্ট ইমেজ লিংক (যা হোয়াটসঅ্যাপে খুব দ্রুত ও সুন্দরভাবে লোড হয়)
const BOT_IMAGE_URL = "https://files.catbox.moe/8xy543.png";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    browser: Browsers.macOS('Chrome'),
    printQRInTerminal: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('call', async (node) => {
    if (!antiCallActive) return;
    for (const call of node) {
      if (call.status === 'offer') {
        await sock.rejectCall(call.id, call.from);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const m = messages[0];
    if (!m.message) return;

    const sender = m.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');
    const userJid = m.key.participant || sender;

    const msgContent = m.message.ephemeralMessage?.message || m.message.viewOnceMessage?.message || m.message;
    const body = msgContent.conversation || 
                 msgContent.extendedTextMessage?.text || 
                 msgContent.imageMessage?.caption || 
                 msgContent.videoMessage?.caption || '';

    if (isGroup && antiLinkActive && !m.key.fromMe) {
      if (body.includes('http://') || body.includes('https://') || body.includes('chat.whatsapp.com')) {
        try {
          await sock.sendMessage(sender, { delete: m.key });
          await sock.sendMessage(sender, { 
            text: `🚫 @${userJid.split('@')[0]} — ʟɪɴᴋꜱ ᴀʀᴇ ɴᴏᴛ ᴀʟʟᴏᴡᴇᴅ ʜᴇʀᴇ.`,
            mentions: [userJid]
          });
        } catch (e) {}
        return;
      }
    }

    if (!body) return;

    const isCommand = body.startsWith('.');
    const args = body.slice(1).trim().split(/ +/);
    const command = isCommand ? args.shift().toLowerCase() : '';

    if (isCommand) {
      if (botMode === "private" && !m.key.fromMe) return;
    }

    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const uptimeFormatted = `${hours}ʜ ${minutes}ᴍ ${seconds}ꜱ`;

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (command === 'mode') {
      if (!m.key.fromMe) return;
      const targetMode = args[0]?.toLowerCase();
      if (['public', 'admin', 'private'].includes(targetMode)) {
        botMode = targetMode;
        await sock.sendMessage(sender, { text: `⚡ ʙᴏᴛ ᴍᴏᴅᴇ: [ ${botMode.toUpperCase()} ]` }, { quoted: m });
      }
    } 
    else if (command === 'antilink') {
      const status = args[0]?.toLowerCase();
      if (status === 'on') {
        antiLinkActive = true;
        await sock.sendMessage(sender, { text: `🛡️ ᴀɴᴛɪ-ʟɪɴᴋ ᴀᴄᴛɪᴠᴀᴛᴇᴅ!` }, { quoted: m });
      } else if (status === 'off') {
        antiLinkActive = false;
        await sock.sendMessage(sender, { text: `🛡️ ᴀɴᴛɪ-ʟɪɴᴋ ᴅᴇᴀᴄᴛɪᴠᴀᴛᴇᴅ!` }, { quoted: m });
      }
    }
    else if (command === 'antigcstatus') {
      const status = args[0]?.toLowerCase();
      if (['on', 'kick', 'warn', 'delete'].includes(status)) {
        antiGcStatusActive = true;
        antiGcStatusMode = status;
        await sock.sendMessage(sender, { text: `🛡️ ᴀɴᴛɪ-ɢᴄ-ꜱᴛᴀᴛᴜꜱ ꜱᴇᴛ ᴛᴏ: [ ${status.toUpperCase()} ]` }, { quoted: m });
      } else if (status === 'off') {
        antiGcStatusActive = false;
        await sock.sendMessage(sender, { text: `🛡️ ᴀɴᴛɪ-ɢᴄ-ꜱᴛᴀᴛᴜꜱ ᴅᴇᴀᴄᴛɪᴠᴀᴛᴇᴅ!` }, { quoted: m });
      }
    }
    else if (command === 'link') {
      if (!isGroup) return;
      try {
        const code = await sock.groupInviteCode(sender);
        await sock.sendMessage(sender, { text: `🔗 https://chat.whatsapp.com/${code}` }, { quoted: m });
      } catch (err) {}
    }
    else if (command === 'open' || command === 'unmute') {
      if (!isGroup) return;
      try {
        await sock.groupSettingUpdate(sender, 'not_announcement');
        await sock.sendMessage(sender, { text: `🔓 ɢʀᴏᴜᴘ ᴏᴘᴇɴᴇᴅ!` }, { quoted: m });
      } catch (err) {}
    }
    else if (command === 'close' || command === 'mute') {
      if (!isGroup) return;
      try {
        await sock.groupSettingUpdate(sender, 'announcement');
        await sock.sendMessage(sender, { text: `🔒 ɢʀᴏᴜᴘ ᴄʟᴏꜱᴇᴅ!` }, { quoted: m });
      } catch (err) {}
    }
    else if (command === 'ping') {
      const start = Date.now();
      await sock.sendMessage(sender, { text: `⚡ ᴘɪɴɢ: ${Date.now() - start}ᴍꜱ` }, { quoted: m });
    } 
    else if (command === 'menu' || command === 'bot') {
      const fullMenu = 
        `◄⏤͟͞⚡ ${BOT_NAME} ⚡⏤͟͞►\n\n` +
        `❖ ꜱʏꜱᴛᴇᴍ  :: ᴏɴʟɪɴᴇ [ 🟢 100% ]\n` +
        `❖ ᴏᴡɴᴇʀ   :: ${OWNER_NAME}\n` +
        `❖ ᴏᴡɴᴇʀ ᴅᴍ :: ${OWNER_DM}\n` +
        `❖ ᴅᴇᴠ     :: ${DEVELOPER}\n` +
        `❖ ᴍᴏᴅᴇ    :: ${botMode.toUpperCase()}\n` +
        `❖ ᴜᴘᴛɪᴍᴇ :: ${uptimeFormatted}\n` +
        `❖ ᴛɪᴍᴇ    :: ${timeString}\n` +
        `❖ ᴘᴀɪʀ    :: ${PAIR_LINK}\n\n` +

        `┏━━[ 01 ]━ 🛡 ᴘʀᴏᴛᴇᴄᴛɪᴏɴ ━◈\n` +
        `┃ ▸ .antilink on/warn/kick/delete\n` +
        `┃ ▸ .antisticker on/delete/warn\n` +
        `┃ ▸ .antispam on/kick/off\n` +
        `┃ ▸ .antigcstatus on/kick/warn/delete\n` +
        `┃ ▸ .opdelete\n` +
        `┃ ▸ .antiemoji • .antitag\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 02 ]━ 🔐 ꜱᴇᴄᴜʀɪᴛʏ ᴘʟᴜꜱ ━◈\n` +
        `┃ ▸ .warnlist\n` +
        `┃ ▸ .nightmode on [শুরু শেষ] / off\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 05 ]━ ⏰ ᴀᴜᴛᴏ & ꜱᴍᴀʀᴛ ━◈\n` +
        `┃ ▸ .inactive [দিন] • .schedule HH:MM <মেসেজ>\n` +
        `┃ ▸ .rules • .note @user <লেখা> • .autoreply কী | রিপ্লাই\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 06 ]━ 👋 ᴡᴇʟᴄᴏᴍᴇ ━◈\n` +
        `┃ ▸ .welcome on/off/set • .goodbye on/off/set\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 07 ]━ 🕌 ɴᴀᴍᴀᴢ & ᴛɪᴍᴇ ━◈\n` +
        `┃ ▸ .namaztime on/off • .prayer • .time\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 09 ]━ 🎵 ᴍᴇᴅɪᴀ ━◈\n` +
        `┃ ▸ .song • .video • .play • .ytd\n` +
        `┃ ▸ .sticker • .xsticker\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 10 ]━ 🧰 ᴛᴏᴏʟꜱ ━◈\n` +
        `┃ ▸ .link • .opboom <text>\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 11 ]━ 👥 ɢʀᴏᴜᴘ ━◈\n` +
        `┃ ▸ .kick @user • .promote • .demote\n` +
        `┃ ▸ .tagall • .hidetag • .mute • .unmute\n` +
        `┃ ▸ .open • .close • .groupinfo • .admin list\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 14 ]━ 🔗 ᴘᴀɪʀ ━◈\n` +
        `┃ ▸ .pair <number> • .unpair • .botlist\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +

        `┏━━[ 15 ]━ 👑 ᴏᴡɴᴇʀ ━◈\n` +
        `┃ ▸ .anticall on/off\n` +
        `┃ ▸ .mode public/admin/private\n` +
        `┃ ▸ .ping • .alive • .runtime\n` +
        `┗━━━━━━━━━━━━━━━━━◈\n\n` +
        `◄⏤͟͞✦ ᴇxᴄʟᴜꜱɪᴠᴇ ʙʏ ${OWNER_NAME} ✦⏤͟͞►`;

      // Catbox লিংকের মাধ্যমে ছবিসহ মেনু পাঠানো হচ্ছে
      await sock.sendMessage(sender, { 
        image: { url: BOT_IMAGE_URL },
        caption: fullMenu
      }, { quoted: m });

    } else if (isCommand) {
      await sock.sendMessage(sender, { text: `⚡ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ (.${command}) ɪꜱ ᴜɴᴅᴇʀ ᴅᴇᴠᴇʟᴏᴘᴍᴇɴᴛ!` }, { quoted: m });
    }
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log(`\n✅ ${BOT_NAME} CONNECTED SUCCESSFULLY!\n`);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(() => startBot(), 3000);
      }
    }
  });
}

startBot().catch(err => console.error('❌ Fatal Error:', err));
