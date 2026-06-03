// ================================================================
// ANTI-BAN & HUMAN TOUCH UTILITIES
// ================================================================
// Supports @whiskeysockets/baileys AND whatsapp-web.js (wwebjs)
// ================================================================

/**
 * Random delay between min-max seconds (default 15-30s)
 * Use this BETWEEN messages to break automated patterns.
 */
const randomDelay = (minSeconds = 15, maxSeconds = 30) => {
  const secs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds);
  console.log(`[AntiBan] Waiting ${secs} seconds before next message...`);
  return new Promise(resolve => setTimeout(resolve, secs * 1000));
};

// ================================================================
// 1. BAILEYS VERSION  (@whiskeysockets/baileys)
// ================================================================
//
// Usage in your for...of loop:
//   const { sendWithHumanTouchBaileys, randomDelay } = require('./services/antiBanService');
//
//   const numbers = ['918888888888@s.whatsapp.net', '919999999999@s.whatsapp.net'];
//   for (const jid of numbers) {
//     try {
//       await sendWithHumanTouchBaileys(sock, jid, 'Namaste ji! Kya haal hai?');
//       await randomDelay();
//     } catch (err) {
//       console.error(`[Baileys] Failed for ${jid}: ${err.message}`);
//     }
//   }
//
const sendWithHumanTouchBaileys = async (sock, jid, text) => {
  try {
    console.log(`[Baileys] Processing JID: ${jid}`);

    // Step A: Fetch chat via presence subscribe (opens the chat in WhatsApp view)
    console.log(`[Baileys] Opening chat: ${jid}`);
    await sock.presenceSubscribe(jid);
    await new Promise(r => setTimeout(r, 500));

    // Step B: Trigger "Typing..." composing state
    console.log(`[Baileys] Status: Typing... (holding 3s)`);
    await sock.sendPresenceUpdate('composing', jid);

    // Step C: Hold typing for exactly 3 seconds (human typing speed)
    await new Promise(r => setTimeout(r, 3000));

    // Step D: Send the text message
    console.log(`[Baileys] Sending message...`);
    const result = await sock.sendMessage(jid, { text });

    // Step E: Clear typing state
    await sock.sendPresenceUpdate('paused', jid);
    console.log(`[Baileys] Message sent successfully to ${jid}`);

    return result;
  } catch (err) {
    console.error(`[Baileys] Error for ${jid}: ${err.message}`);
    throw err; // Re-throw so caller can handle per-number
  }
};

// ================================================================
// 2. WHATSAPP-WEB.JS VERSION  (wwebjs)
// ================================================================
//
// Usage in your for...of loop:
//   const { sendWithHumanTouchWweb, randomDelay } = require('./services/antiBanService');
//
//   const numbers = ['919888888888@c.us', '919999999999@c.us'];
//   for (const chatId of numbers) {
//     try {
//       await sendWithHumanTouchWweb(client, chatId, 'Namaste ji! Kya haal hai?');
//       await randomDelay();
//     } catch (err) {
//       console.error(`[WWJS] Failed for ${chatId}: ${err.message}`);
//     }
//   }
//
const sendWithHumanTouchWweb = async (client, chatId, text) => {
  try {
    console.log(`[WWJS] Processing chat: ${chatId}`);

    // Step A: Fetch/open the chat
    console.log(`[WWJS] Fetching chat: ${chatId}`);
    const chat = await client.getChatById(chatId);

    // Step B: Mark as read & trigger typing
    await chat.sendSeen();
    console.log(`[WWJS] Status: Typing... (holding 3s)`);
    await chat.sendStateTyping();

    // Step C: Hold typing for exactly 3 seconds
    await new Promise(r => setTimeout(r, 3000));

    // Step D: Clear typing & send message
    await chat.clearState();
    console.log(`[WWJS] Sending message...`);
    const result = await chat.sendMessage(text);

    console.log(`[WWJS] Message sent successfully to ${chatId}`);
    return result;
  } catch (err) {
    console.error(`[WWJS] Error for ${chatId}: ${err.message}`);
    throw err;
  }
};

// ================================================================
// 3. COMPLETE "FOR...OF" LOOP EXAMPLE (Baileys + randomDelay)
// ================================================================
//
// const { randomDelay, sendWithHumanTouchBaileys } = require('./services/antiBanService');
//
// async function sendBulkMessages(sock, contactsArray) {
//   for (const contact of contactsArray) {
//     try {
//       const jid = contact.jid || `${contact.number}@s.whatsapp.net`;
//       await sendWithHumanTouchBaileys(sock, jid, contact.message);
//       await randomDelay(15, 30);
//     } catch (err) {
//       console.error(`[Baileys] Skipping ${contact.number} due to error: ${err.message}`);
//       continue;
//     }
//   }
//   console.log('[Baileys] Bulk send complete.');
// }
//
// ================================================================
// 4. COMPLETE "FOR...OF" LOOP EXAMPLE (whatsapp-web.js + randomDelay)
// ================================================================
//
// const { randomDelay, sendWithHumanTouchWweb } = require('./services/antiBanService');
//
// async function sendBulkMessages(client, contactsArray) {
//   for (const contact of contactsArray) {
//     try {
//       const chatId = `${contact.number}@c.us`;
//       await sendWithHumanTouchWweb(client, chatId, contact.message);
//       await randomDelay(15, 30);
//     } catch (err) {
//       console.error(`[WWJS] Skipping ${contact.number} due to error: ${err.message}`);
//       continue;
//     }
//   }
//   console.log('[WWJS] Bulk send complete.');
// }
// ================================================================

module.exports = {
  randomDelay,
  sendWithHumanTouchBaileys,
  sendWithHumanTouchWweb,
};
