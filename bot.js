import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Config
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const A1111_URL = process.env.A1111_URL || 'http://127.0.0.1:7860';

// Default Settings für Bildergeneration
const DEFAULT_CONFIG = {
  steps: 30,
  cfg_scale: 7,
  width: 512,
  height: 640,
  sampler_name: "DPM++ 2M Karras",
  negative_prompt: "ugly, blurry, bad quality, distorted, deformed",
  seed: -1,  // Random seed
  
  // Model Settings
  checkpoint: "aom3.safetensors",
  vae: "vae-ft-mse-840000-ema-pruned.safetensors",
  
  // LoRA + Default Prefix
  loras: [
    { name: "yuki_lora", weight: 0.7 }  // LoRA Name + Stärke (0.0-1.0)
  ],
  default_prompt_prefix: "yukichar, 1girl, purple hair"  // Standard-Tags vor jedem Prompt
};

// Bot initialisieren
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram SD Bot gestartet!');

// Clothing LoRAs
const CLOTHING_LORAS = [
  { name: 'asos-kokoboots-n', display: '👢 Boots' },
  { name: 'bike_shorts_noobaI_V1.0', display: '🚴 Bike Shorts' },
  { name: 'bra_peek_irl_goofy', display: '👙 Bra Peek' },
  { name: 'cmo-fashion-illustriousxl-lora-nochekai', display: '👗 Fashion' },
  { name: 'hotpants_noobaI_V1.0', display: '🩳 Hotpants' },
  { name: 'JuicyTrackSuitILL', display: '🏃 Tracksuit' },
  { name: 'jyojifuku_illustrious_V2.0', display: '👔 Jyojifuku' },
  { name: 'oversized shirt_noobal_V1.0', display: '👕 Oversized Shirt' },
  { name: 'PYGmalionWomanILL', display: '👗 Pygmalion' },
  { name: 'SecretaryLingerieILL', display: '💼 Secretary' },
  { name: 'taisouifuku_noobal_V1.0', display: '🤸 Gym Outfit' },
  { name: 'thickblackhighlights_i1_v2', display: '✨ Highlights' },
  { name: 'volleyball uniform', display: '🏐 Volleyball' },
  { name: 'xlAEC_g102', display: '🎨 AEC Style' }
];

// Session state für User
const userSessions = {};

// /start Command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  // Clothing Menu erstellen
  const clothingKeyboard = [];
  for (let i = 0; i < CLOTHING_LORAS.length; i += 2) {
    const row = [
      { text: CLOTHING_LORAS[i].display, callback_data: `cloth_${i}` }
    ];
    if (i + 1 < CLOTHING_LORAS.length) {
      row.push({ text: CLOTHING_LORAS[i + 1].display, callback_data: `cloth_${i + 1}` });
    }
    clothingKeyboard.push(row);
  }
  
  bot.sendMessage(chatId, 
    `🎨 *Yuki Image Generator*\n\n` +
    `Wähle ein Outfit oder sende direkt einen Prompt!\n\n` +
    `*Commands:*\n` +
    `/clothing - Outfit wählen\n` +
    `/settings - Aktuelle Einstellungen\n` +
    `/help - Hilfe anzeigen`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: clothingKeyboard
      }
    }
  );
});

// /help Command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `*Wie benutzt man den Bot:*\n\n` +
    `1️⃣ Wähle Outfit mit /clothing\n` +
    `2️⃣ Sende Prompt: \`sitting on a bench\`\n` +
    `3️⃣ Oder direkt: \`walking in a forest\`\n\n` +
    `*Einstellungen:*\n` +
    `• Steps: ${DEFAULT_CONFIG.steps}\n` +
    `• CFG Scale: ${DEFAULT_CONFIG.cfg_scale}\n` +
    `• Größe: ${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}\n` +
    `• Sampler: ${DEFAULT_CONFIG.sampler_name}\n` +
    `• Default Prefix: ${DEFAULT_CONFIG.default_prompt_prefix || 'Keiner'}\n\n` +
    `LoRAs und Negative Prompts sind voreingestellt. Nutze /settings für Details.`,
    { parse_mode: 'Markdown' }
  );
});

// /clothing Command
bot.onText(/\/clothing/, (msg) => {
  const chatId = msg.chat.id;
  
  // Clothing Menu erstellen
  const clothingKeyboard = [];
  for (let i = 0; i < CLOTHING_LORAS.length; i += 2) {
    const row = [
      { text: CLOTHING_LORAS[i].display, callback_data: `cloth_${i}` }
    ];
    if (i + 1 < CLOTHING_LORAS.length) {
      row.push({ text: CLOTHING_LORAS[i + 1].display, callback_data: `cloth_${i + 1}` });
    }
    clothingKeyboard.push(row);
  }
  
  // Aktuelles Outfit anzeigen
  const currentSession = userSessions[chatId] || {};
  const currentClothing = currentSession.clothing || 'Keine Auswahl';
  
  bot.sendMessage(chatId,
    `👗 *Wähle Outfit für Yuki*\n\n` +
    `Aktuell: ${currentClothing}\n\n` +
    `Klicke ein Outfit, dann sende deinen Prompt!`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: clothingKeyboard
      }
    }
  );
});

// /settings Command
bot.onText(/\/settings/, (msg) => {
  const chatId = msg.chat.id;
  
  let loraText = 'Keine';
  if (DEFAULT_CONFIG.loras && DEFAULT_CONFIG.loras.length > 0) {
    loraText = DEFAULT_CONFIG.loras.map(l => `${l.name} (${l.weight})`).join(', ');
  }
  
  let prefixText = DEFAULT_CONFIG.default_prompt_prefix || 'Keiner';
  
  bot.sendMessage(chatId,
    `⚙️ Aktuelle Einstellungen:\n\n` +
    `• Model: ${DEFAULT_CONFIG.checkpoint}\n` +
    `• VAE: ${DEFAULT_CONFIG.vae}\n` +
    `• Steps: ${DEFAULT_CONFIG.steps}\n` +
    `• CFG Scale: ${DEFAULT_CONFIG.cfg_scale}\n` +
    `• Auflösung: ${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}\n` +
    `• Sampler: ${DEFAULT_CONFIG.sampler_name}\n` +
    `• LoRAs: ${loraText}\n` +
    `• Default Prefix: ${prefixText}\n` +
    `• Negative Prompt: ${DEFAULT_CONFIG.negative_prompt}\n` +
    `• Seed: ${DEFAULT_CONFIG.seed === -1 ? 'Random' : DEFAULT_CONFIG.seed}`
  );
});

// /generate <prompt> Command
bot.onText(/\/generate (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];
  
  await generateImage(chatId, prompt);
});

// Callback Query Handler (Button Clicks)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  // Clothing Selection
  if (data.startsWith('cloth_')) {
    const index = parseInt(data.replace('cloth_', ''));
    const selectedClothing = CLOTHING_LORAS[index];
    
    // Session initialisieren falls nötig
    if (!userSessions[chatId]) {
      userSessions[chatId] = {};
    }
    
    // Clothing LoRA setzen
    userSessions[chatId].clothing = selectedClothing.display;
    userSessions[chatId].clothingLora = selectedClothing.name;
    
    // Bestätigung
    await bot.answerCallbackQuery(query.id, {
      text: `✅ ${selectedClothing.display} ausgewählt!`
    });
    
    await bot.sendMessage(chatId,
      `✅ *Outfit gewählt:* ${selectedClothing.display}\n\n` +
      `Sende jetzt deinen Prompt! (z.B. "sitting on a bench, sunset background")`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Direkte Text-Nachrichten als Prompts behandeln
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignoriere Commands
  if (!text || text.startsWith('/')) return;
  
  await generateImage(chatId, text);
});

// Hauptfunktion: Bild generieren
async function generateImage(chatId, prompt) {
  try {
    // Status-Nachricht
    const statusMsg = await bot.sendMessage(chatId, '🎨 Generiere Bild...');
    
    console.log(`[${new Date().toISOString()}] User prompt: "${prompt}"`);
    
    // Build full prompt: LoRAs + Default Prefix + User Prompt
    let fullPrompt = '';
    
    // 1. Character LoRAs hinzufügen (immer)
    if (DEFAULT_CONFIG.loras && DEFAULT_CONFIG.loras.length > 0) {
      const loraStrings = DEFAULT_CONFIG.loras.map(lora => 
        `<lora:${lora.name}:${lora.weight}>`
      );
      fullPrompt += loraStrings.join(' ') + ' ';
    }
    
    // 2. Clothing LoRA hinzufügen (falls gewählt)
    const session = userSessions[chatId] || {};
    if (session.clothingLora) {
      fullPrompt += `<lora:${session.clothingLora}:0.7> `;
    }
    
    // 3. Default Prefix hinzufügen
    if (DEFAULT_CONFIG.default_prompt_prefix) {
      fullPrompt += DEFAULT_CONFIG.default_prompt_prefix + ', ';
    }
    
    // 4. User Prompt hinzufügen
    fullPrompt += prompt;
    
    console.log(`[${new Date().toISOString()}] Full prompt: "${fullPrompt}"`);
    
    // API Request an Automatic1111
    const payload = {
      prompt: fullPrompt,
      negative_prompt: DEFAULT_CONFIG.negative_prompt,
      steps: DEFAULT_CONFIG.steps,
      cfg_scale: DEFAULT_CONFIG.cfg_scale,
      width: DEFAULT_CONFIG.width,
      height: DEFAULT_CONFIG.height,
      sampler_name: DEFAULT_CONFIG.sampler_name,
      seed: DEFAULT_CONFIG.seed,
      
      // Model & VAE Override
      override_settings: {
        sd_model_checkpoint: DEFAULT_CONFIG.checkpoint,
        sd_vae: DEFAULT_CONFIG.vae
      },
      override_settings_restore_afterwards: false
    };
    
    const response = await axios.post(
      `${A1111_URL}/sdapi/v1/txt2img`,
      payload,
      { timeout: 120000 } // 2 Minuten Timeout
    );
    
    // Bild aus Response holen (Base64)
    const imageBase64 = response.data.images[0];
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // Status-Nachricht löschen
    await bot.deleteMessage(chatId, statusMsg.message_id);
    
    // Caption mit LoRA-Info (ohne Markdown wegen <> in LoRA-Syntax)
    let caption = `🎨 Prompt: ${prompt}\n\n`;
    
    // Character LoRA Info
    if (DEFAULT_CONFIG.loras && DEFAULT_CONFIG.loras.length > 0) {
      const loraInfo = DEFAULT_CONFIG.loras.map(l => `${l.name} (${l.weight})`).join(', ');
      caption += `Character: ${loraInfo}\n`;
    }
    
    // Clothing LoRA Info
    if (session.clothingLora) {
      caption += `Outfit: ${session.clothing} (${session.clothingLora})\n`;
    }
    
    caption += `\nSteps: ${DEFAULT_CONFIG.steps} | CFG: ${DEFAULT_CONFIG.cfg_scale} | ${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}`;
    
    // Bild senden (ohne parse_mode wegen LoRA <> Zeichen)
    await bot.sendPhoto(chatId, imageBuffer, {
      caption: caption
    });
    
    console.log(`[${new Date().toISOString()}] ✅ Image sent to chat ${chatId}`);
    
  } catch (error) {
    console.error('Error generating image:', error.message);
    
    // Fehler-Nachricht
    let errorMsg = '❌ Fehler beim Generieren:\n\n';
    
    if (error.code === 'ECONNREFUSED') {
      errorMsg += '🔴 Automatic1111 ist nicht erreichbar!\n';
      errorMsg += `Stelle sicher, dass A1111 auf ${A1111_URL} läuft.`;
    } else if (error.response) {
      errorMsg += `Server Error: ${error.response.status}\n`;
      errorMsg += error.response.data?.error || 'Unbekannter Fehler';
    } else {
      errorMsg += error.message;
    }
    
    bot.sendMessage(chatId, errorMsg);
  }
}

// Error Handler
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Bot wird beendet...');
  bot.stopPolling();
  process.exit(0);
});
