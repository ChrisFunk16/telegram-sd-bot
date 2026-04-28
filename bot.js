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

// ==================== LORA CATEGORIES ====================

const LORA_CATEGORIES = {
  clothing: [
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
  ],
  
  pose: [
    { name: 'feet v2.1', display: '🦶 Feet Focus' },
    { name: 'dio-brandes-pose-illustrious1-lora-nochelaiser', display: '🧍 Dio Brandes' },
    { name: 'convenientcensoringinnetube_illust_v1', display: '🚫 Censoring Pose' },
    { name: 'crossed arms_noobaI_V1.0', display: '✖️ Crossed Arms' },
    { name: 'Cobra_pose', display: '🐍 Cobra Pose' },
    { name: 'hand over own mouth_noobaI_V1.0', display: '🤭 Hand Over Mouth' },
    { name: 'ironbend_illust_v1', display: '💪 Iron Bend' },
    { name: 'skirt tug_illustrious_V2.0', display: '👗 Skirt Tug' },
    { name: 'under covers - ll_v1.0', display: '🛏️ Under Covers' },
    { name: 'labedon_illustrious', display: '😴 Laying Bed' },
    { name: 'outstretched_legs_il_2_v2-final', display: '🦵 Outstretched Legs' }
  ],
  
  background: [
    { name: 'city_bg', display: '🏙️ City' },
    { name: 'nature_bg', display: '🌲 Nature' },
    { name: 'bedroom_bg', display: '🛏️ Bedroom' },
    { name: 'studio_bg', display: '📸 Studio' }
  ],
  
  style: [
    { name: 'anime_style', display: '🎌 Anime' },
    { name: 'realistic_style', display: '📷 Realistic' },
    { name: 'painting_style', display: '🎨 Painted' }
  ]
};

const WIZARD_STEPS = ['clothing', 'pose', 'background', 'style', 'prompt'];

const STEP_TITLES = {
  clothing: '👗 Wähle Clothing (0-N)',
  pose: '💃 Wähle Pose (0-N)',
  background: '🏞️ Wähle Background (0-N)',
  style: '🎨 Wähle Style (0-N)',
  prompt: '📝 Sende deinen Prompt'
};

// ==================== SESSION MANAGEMENT ====================

const userSessions = {};

function getSession(chatId) {
  if (!userSessions[chatId]) {
    userSessions[chatId] = {
      wizardActive: false,
      currentStep: 0,
      selections: {
        clothing: [],
        pose: [],
        background: [],
        style: []
      }
    };
  }
  return userSessions[chatId];
}

function resetWizard(chatId) {
  const session = getSession(chatId);
  session.wizardActive = false;
  session.currentStep = 0;
  session.selections = {
    clothing: [],
    pose: [],
    background: [],
    style: []
  };
}

// ==================== MENU BUILDERS ====================

function buildCategoryMenu(chatId, category) {
  const session = getSession(chatId);
  const items = LORA_CATEGORIES[category];
  const selected = session.selections[category] || [];
  
  const keyboard = [];
  
  // Items in 2-column grid
  for (let i = 0; i < items.length; i += 2) {
    const isSelected1 = selected.includes(i);
    const checkmark1 = isSelected1 ? '✅ ' : '';
    
    const row = [
      { 
        text: checkmark1 + items[i].display, 
        callback_data: `wiz_select_${category}_${i}` 
      }
    ];
    
    if (i + 1 < items.length) {
      const isSelected2 = selected.includes(i + 1);
      const checkmark2 = isSelected2 ? '✅ ' : '';
      row.push({ 
        text: checkmark2 + items[i + 1].display, 
        callback_data: `wiz_select_${category}_${i + 1}` 
      });
    }
    
    keyboard.push(row);
  }
  
  // Navigation buttons
  const navRow = [];
  
  // Back button (if not first step)
  if (session.currentStep > 0) {
    navRow.push({ text: '◀️ Zurück', callback_data: 'wiz_back' });
  }
  
  // Next/Skip button
  navRow.push({ text: '▶️ Weiter', callback_data: 'wiz_next' });
  
  keyboard.push(navRow);
  
  // Reset button
  if (selected.length > 0) {
    keyboard.push([
      { text: '🗑️ Auswahl löschen', callback_data: `wiz_reset_${category}` }
    ]);
  }
  
  return keyboard;
}

function getSelectionSummary(session) {
  let summary = '';
  
  for (const [category, indices] of Object.entries(session.selections)) {
    if (indices.length > 0) {
      const items = LORA_CATEGORIES[category];
      const names = indices.map(idx => items[idx].display);
      summary += `${category}: ${names.join(', ')}\n`;
    }
  }
  
  return summary || 'Keine Auswahl';
}

// ==================== BOT SETUP ====================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram SD Bot gestartet!');

// ==================== COMMANDS ====================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    `🎨 *Yuki Image Generator*\n\n` +
    `Nutze /generate um Schritt für Schritt ein Bild zu erstellen!\n\n` +
    `*Commands:*\n` +
    `/generate - Wizard starten\n` +
    `/settings - Aktuelle Einstellungen\n` +
    `/help - Hilfe anzeigen`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `*Workflow:*\n\n` +
    `1️⃣ /generate - Wizard starten\n` +
    `2️⃣ Wähle Clothing (0-N)\n` +
    `3️⃣ Wähle Pose (0-N)\n` +
    `4️⃣ Wähle Background (0-N)\n` +
    `5️⃣ Wähle Style (0-N)\n` +
    `6️⃣ Sende Prompt → Bild generiert!\n\n` +
    `✅ = Ausgewählt (mehrere pro Kategorie möglich)\n` +
    `▶️ Weiter = Skip zur nächsten Kategorie\n` +
    `◀️ Zurück = Vorherige Kategorie\n\n` +
    `*Einstellungen:*\n` +
    `• Steps: ${DEFAULT_CONFIG.steps}\n` +
    `• CFG Scale: ${DEFAULT_CONFIG.cfg_scale}\n` +
    `• Größe: ${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}\n` +
    `• Sampler: ${DEFAULT_CONFIG.sampler_name}`,
    { parse_mode: 'Markdown' }
  );
});

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
    `• Character LoRA: ${loraText}\n` +
    `• Default Prefix: ${prefixText}\n` +
    `• Negative Prompt: ${DEFAULT_CONFIG.negative_prompt}\n` +
    `• Seed: ${DEFAULT_CONFIG.seed === -1 ? 'Random' : DEFAULT_CONFIG.seed}`
  );
});

// ==================== WIZARD START ====================

bot.onText(/\/generate/, (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  
  // Reset and start wizard
  resetWizard(chatId);
  session.wizardActive = true;
  session.currentStep = 0;
  
  showWizardStep(chatId);
});

function showWizardStep(chatId) {
  const session = getSession(chatId);
  const stepName = WIZARD_STEPS[session.currentStep];
  
  // Final step: Prompt input
  if (stepName === 'prompt') {
    const summary = getSelectionSummary(session);
    
    bot.sendMessage(chatId,
      `📝 *Schritt 5/5: Prompt*\n\n` +
      `Deine Auswahl:\n${summary}\n\n` +
      `Sende jetzt deinen Prompt!\n` +
      `(z.B. "sitting on a bench, sunset, smiling")`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Show category selection
  const keyboard = buildCategoryMenu(chatId, stepName);
  const stepNumber = session.currentStep + 1;
  const totalSteps = WIZARD_STEPS.length;
  
  const selected = session.selections[stepName] || [];
  const items = LORA_CATEGORIES[stepName];
  const selectedNames = selected.map(idx => items[idx].display);
  const selectionText = selectedNames.length > 0 ? selectedNames.join(', ') : 'Keine';
  
  bot.sendMessage(chatId,
    `${STEP_TITLES[stepName]}\n\n` +
    `Schritt ${stepNumber}/${totalSteps}\n` +
    `✅ = Ausgewählt | ▶️ Weiter = Skip\n\n` +
    `Aktuell: ${selectionText}`,
    {
      reply_markup: {
        inline_keyboard: keyboard
      }
    }
  );
}

// ==================== CALLBACK HANDLERS ====================

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  
  const session = getSession(chatId);
  
  if (!session.wizardActive) {
    await bot.answerCallbackQuery(query.id, {
      text: '⚠️ Kein aktiver Wizard! Nutze /generate'
    });
    return;
  }
  
  const stepName = WIZARD_STEPS[session.currentStep];
  
  // ===== NAVIGATION =====
  
  if (data === 'wiz_next') {
    // Move to next step
    session.currentStep++;
    
    await bot.answerCallbackQuery(query.id, {
      text: '▶️ Weiter'
    });
    
    await bot.deleteMessage(chatId, messageId);
    showWizardStep(chatId);
    return;
  }
  
  if (data === 'wiz_back') {
    // Move to previous step
    session.currentStep--;
    
    await bot.answerCallbackQuery(query.id, {
      text: '◀️ Zurück'
    });
    
    await bot.deleteMessage(chatId, messageId);
    showWizardStep(chatId);
    return;
  }
  
  // ===== RESET CATEGORY =====
  
  if (data.startsWith('wiz_reset_')) {
    const category = data.replace('wiz_reset_', '');
    session.selections[category] = [];
    
    await bot.answerCallbackQuery(query.id, {
      text: '🗑️ Auswahl gelöscht'
    });
    
    const keyboard = buildCategoryMenu(chatId, category);
    await bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      { chat_id: chatId, message_id: messageId }
    );
    
    // Update text
    const stepNumber = session.currentStep + 1;
    const totalSteps = WIZARD_STEPS.length;
    
    await bot.editMessageText(
      `${STEP_TITLES[category]}\n\n` +
      `Schritt ${stepNumber}/${totalSteps}\n` +
      `✅ = Ausgewählt | ▶️ Weiter = Skip\n\n` +
      `Aktuell: Keine`,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
    
    return;
  }
  
  // ===== ITEM SELECTION TOGGLE =====
  
  if (data.startsWith('wiz_select_')) {
    const parts = data.replace('wiz_select_', '').split('_');
    const category = parts[0];
    const index = parseInt(parts[1]);
    
    const items = LORA_CATEGORIES[category];
    const item = items[index];
    
    // Toggle selection
    const currentSelected = session.selections[category] || [];
    const indexPos = currentSelected.indexOf(index);
    
    if (indexPos > -1) {
      // Remove
      currentSelected.splice(indexPos, 1);
      await bot.answerCallbackQuery(query.id, {
        text: `❌ ${item.display} abgewählt`
      });
    } else {
      // Add
      currentSelected.push(index);
      await bot.answerCallbackQuery(query.id, {
        text: `✅ ${item.display}`
      });
    }
    
    session.selections[category] = currentSelected;
    
    // Update menu
    const keyboard = buildCategoryMenu(chatId, category);
    await bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      { chat_id: chatId, message_id: messageId }
    );
    
    // Update text
    const stepNumber = session.currentStep + 1;
    const totalSteps = WIZARD_STEPS.length;
    const selectedNames = currentSelected.map(idx => items[idx].display);
    const selectionText = selectedNames.length > 0 ? selectedNames.join(', ') : 'Keine';
    
    await bot.editMessageText(
      `${STEP_TITLES[category]}\n\n` +
      `Schritt ${stepNumber}/${totalSteps}\n` +
      `✅ = Ausgewählt | ▶️ Weiter = Skip\n\n` +
      `Aktuell: ${selectionText}`,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
    
    return;
  }
});

// ==================== PROMPT HANDLER ====================

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignore commands
  if (!text || text.startsWith('/')) return;
  
  const session = getSession(chatId);
  
  // Check if waiting for prompt in wizard
  if (session.wizardActive && WIZARD_STEPS[session.currentStep] === 'prompt') {
    // Generate with selections
    await generateImage(chatId, text);
    
    // Reset wizard
    resetWizard(chatId);
    
    return;
  }
  
  // Direct prompt (no wizard active)
  if (!session.wizardActive) {
    await generateImage(chatId, text);
  }
});

// ==================== IMAGE GENERATION ====================

async function generateImage(chatId, prompt) {
  try {
    const statusMsg = await bot.sendMessage(chatId, '🎨 Generiere Bild...');
    
    console.log(`[${new Date().toISOString()}] User prompt: "${prompt}"`);
    
    const session = getSession(chatId);
    
    // Build full prompt with all LoRAs
    let fullPrompt = '';
    
    // 1. Character LoRAs (always)
    if (DEFAULT_CONFIG.loras && DEFAULT_CONFIG.loras.length > 0) {
      const loraStrings = DEFAULT_CONFIG.loras.map(lora => 
        `<lora:${lora.name}:${lora.weight}>`
      );
      fullPrompt += loraStrings.join(' ') + ' ';
    }
    
    // 2. Add selected LoRAs from wizard
    for (const [category, indices] of Object.entries(session.selections)) {
      if (indices.length > 0) {
        const items = LORA_CATEGORIES[category];
        const loraStrings = indices.map(idx => {
          const item = items[idx];
          return `<lora:${item.name}:0.7>`;
        });
        fullPrompt += loraStrings.join(' ') + ' ';
      }
    }
    
    // 3. Default prefix
    if (DEFAULT_CONFIG.default_prompt_prefix) {
      fullPrompt += DEFAULT_CONFIG.default_prompt_prefix + ', ';
    }
    
    // 4. User prompt
    fullPrompt += prompt;
    
    console.log(`[${new Date().toISOString()}] Full prompt: "${fullPrompt}"`);
    
    // API Request
    const payload = {
      prompt: fullPrompt,
      negative_prompt: DEFAULT_CONFIG.negative_prompt,
      steps: DEFAULT_CONFIG.steps,
      cfg_scale: DEFAULT_CONFIG.cfg_scale,
      width: DEFAULT_CONFIG.width,
      height: DEFAULT_CONFIG.height,
      sampler_name: DEFAULT_CONFIG.sampler_name,
      seed: DEFAULT_CONFIG.seed,
      
      override_settings: {
        sd_model_checkpoint: DEFAULT_CONFIG.checkpoint,
        sd_vae: DEFAULT_CONFIG.vae
      },
      override_settings_restore_afterwards: false
    };
    
    const response = await axios.post(
      `${A1111_URL}/sdapi/v1/txt2img`,
      payload,
      { timeout: 120000 }
    );
    
    const imageBase64 = response.data.images[0];
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    await bot.deleteMessage(chatId, statusMsg.message_id);
    
    // Build caption
    let caption = `🎨 ${prompt}\n\n`;
    
    // Show selected LoRAs
    for (const [category, indices] of Object.entries(session.selections)) {
      if (indices.length > 0) {
        const items = LORA_CATEGORIES[category];
        const names = indices.map(idx => items[idx].display);
        caption += `${category}: ${names.join(', ')}\n`;
      }
    }
    
    caption += `\n${DEFAULT_CONFIG.steps} steps | CFG ${DEFAULT_CONFIG.cfg_scale} | ${DEFAULT_CONFIG.width}x${DEFAULT_CONFIG.height}`;
    
    await bot.sendPhoto(chatId, imageBuffer, {
      caption: caption
    });
    
    console.log(`[${new Date().toISOString()}] ✅ Image sent to chat ${chatId}`);
    
  } catch (error) {
    console.error('Error generating image:', error.message);
    
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

// ==================== ERROR HANDLERS ====================

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n👋 Bot wird beendet...');
  bot.stopPolling();
  process.exit(0);
});
