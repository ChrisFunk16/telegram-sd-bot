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
  height: 512,
  sampler_name: "Euler a",
  negative_prompt: "ugly, blurry, bad quality, distorted, deformed",
  seed: -1  // Random seed
};

// Bot initialisieren
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram SD Bot gestartet!');

// /start Command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    `🎨 *Stable Diffusion Bot*\n\n` +
    `Sende einfach einen Text-Prompt und ich generiere ein Bild!\n\n` +
    `*Commands:*\n` +
    `/generate <prompt> - Bild generieren\n` +
    `/settings - Aktuelle Einstellungen\n` +
    `/help - Hilfe anzeigen`,
    { parse_mode: 'Markdown' }
  );
});

// /help Command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `*Wie benutzt man den Bot:*\n\n` +
    `1️⃣ Sende einen Prompt: \`/generate a cat in space\`\n` +
    `2️⃣ Oder schreib einfach direkt: \`a beautiful sunset\`\n\n` +
    `*Einstellungen:*\n` +
    `• Steps: ${DEFAULT_CONFIG.steps}\n` +
    `• CFG Scale: ${DEFAULT_CONFIG.cfg_scale}\n` +
    `• Größe: ${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}\n` +
    `• Sampler: ${DEFAULT_CONFIG.sampler_name}\n\n` +
    `Negative Prompt ist voreingestellt (low quality, blurry, etc.)`,
    { parse_mode: 'Markdown' }
  );
});

// /settings Command
bot.onText(/\/settings/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `⚙️ *Aktuelle Einstellungen:*\n\n` +
    `• Steps: ${DEFAULT_CONFIG.steps}\n` +
    `• CFG Scale: ${DEFAULT_CONFIG.cfg_scale}\n` +
    `• Auflösung: ${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}\n` +
    `• Sampler: ${DEFAULT_CONFIG.sampler_name}\n` +
    `• Negative Prompt: ${DEFAULT_CONFIG.negative_prompt}\n` +
    `• Seed: ${DEFAULT_CONFIG.seed === -1 ? 'Random' : DEFAULT_CONFIG.seed}`,
    { parse_mode: 'Markdown' }
  );
});

// /generate <prompt> Command
bot.onText(/\/generate (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];
  
  await generateImage(chatId, prompt);
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
    
    console.log(`[${new Date().toISOString()}] Generating: "${prompt}"`);
    
    // API Request an Automatic1111
    const payload = {
      prompt: prompt,
      negative_prompt: DEFAULT_CONFIG.negative_prompt,
      steps: DEFAULT_CONFIG.steps,
      cfg_scale: DEFAULT_CONFIG.cfg_scale,
      width: DEFAULT_CONFIG.width,
      height: DEFAULT_CONFIG.height,
      sampler_name: DEFAULT_CONFIG.sampler_name,
      seed: DEFAULT_CONFIG.seed
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
    
    // Bild senden
    await bot.sendPhoto(chatId, imageBuffer, {
      caption: `🎨 *Prompt:* ${prompt}\n\n` +
               `Steps: ${DEFAULT_CONFIG.steps} | CFG: ${DEFAULT_CONFIG.cfg_scale} | ${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}`,
      parse_mode: 'Markdown'
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
