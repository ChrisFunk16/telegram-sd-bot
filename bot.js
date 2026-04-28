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
  steps: 20,    // Reduziert für schnellere Tests
  cfg_scale: 7,
  width: 512,   // Erstmal niedrig für Tests (VRAM-schonend)
  height: 768,  // Portrait format
  sampler_name: "DPM++ 2M Karras",
  
  // Für XL Models normalerweise: width: 832, height: 1216
  // Für SD 1.5 Models: width: 512, height: 640
  negative_prompt: "ugly, blurry, bad quality, distorted, deformed",
  seed: -1,  // Random seed
  
  // Model Settings (WICHTIG: Name MUSS EXAKT mit A1111 Model-Liste übereinstimmen!)
  // Nutze /checkmodel um den exakten Namen zu sehen!
  // Wenn Model-Switch fehlschlägt (500 Error) → einfach leer lassen "" und manuell in A1111 wählen
  checkpoint: "",  // Leer = nutze was in A1111 GUI gewählt ist
  vae: "",  // Leer = nutze default VAE
  
  // Alternative Models (zum Wechseln via /setmodel):
  // "AOM3.safetensors" (SD 1.5 - braucht anderen VAE!)
  // "counterfeitV30_v30.safetensors"
  // "realisticVisionV51_v51VAE.safetensors"
  
  // Character LoRA + Default Prefix
  // WICHTIG: LoRA-Name muss EXAKT dem Dateinamen in models/Lora/ entsprechen (ohne .safetensors)
  // DEAKTIVIERT für Tests - aktiviere wenn LoRA existiert!
  loras: [
    // { name: "yuki_lora", weight: 0.8 }  // Dein Character LoRA (ANPASSEN!)
  ],
  default_prompt_prefix: ""  // Leer für Tests
  // Später: "yukichar, 1girl, purple hair, cat ears"
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
    { name: 'M4DSCIENCE3-PONYXL', display: '🔬 Mad Science Lab' },
    { name: 'large_industrial_stud10-p', display: '🏭 Industrial Studio' },
    { name: 'medieval_castle_prison_c3ll-p', display: '🏰 Castle Prison' },
    { name: 'high_school_h4llw4y-p', display: '🏫 School Hallway' },
    { name: 'baroque_gothic_ch4mb3r-p', display: '⛪ Gothic Chamber' },
    { name: 'dirty_public_r3str00m-p', display: '🚻 Public Restroom' },
    { name: 'Ayuri2424PDXL32v0.50[fa1-000009', display: '🎨 Ayuri Style' },
    { name: 'landscape_PONY', display: '🌄 Landscape' },
    { name: 'futuristic_high-tech_l4b0r4t0ry-p', display: '🔭 Futuristic Lab' },
    { name: 'traditional_Japanese_d0j0-p', display: '🏯 Japanese Dojo' },
    { name: 'glass_containment_ch4mb3r-p', display: '🧪 Glass Chamber' },
    { name: 'medical_examination_r00m-p', display: '🏥 Medical Room' },
    { name: 'SW01v1-5pb', display: '⭐ Star Wars 1' },
    { name: 'SW_Planets_01pony', display: '🌌 Star Wars Planets' },
    { name: 'girlikeconvexmirror_pony', display: '🪞 Convex Mirror' },
    { name: 'cyberpunk_r00fb0p-p', display: '🌃 Cyberpunk Rooftop' },
    { name: 'CWLost_city2pony', display: '🏛️ Lost City' },
    { name: 'bedroom_0f_4_succubus-p', display: '😈 Succubus Bedroom' },
    { name: 'prison_w4ll-p', display: '⛓️ Prison Wall' },
    { name: 'futuristic_b3dr00m-p', display: '🛸 Futuristic Bedroom' }
  ],
  
  style: [
    { name: 'ExpressiveHGothicNeonIncaseStyleMixV2ALLXLbyUOC (1)', display: '🌆 Gothic Neon' },
    { name: 'PatchouliStyle_v6', display: '🎨 Patchouli' },
    { name: '19thwomensa', display: '👗 19th Century' },
    { name: 'Anime_Figure_P1', display: '🗿 Anime Figure' },
    { name: 'Fine_Anime_Screencap-PonyV2', display: '📺 Anime Screencap' },
    { name: 'MeMxXLV3_TypeB_AutismMix', display: '🎭 MeMx Autism' },
    { name: 'DisneyStudios.style-10', display: '🏰 Disney Studios' },
    { name: 'lazyup(1)', display: '✨ LazyUp v1' },
    { name: 'arcane_pony_v2_exmix', display: '🔮 Arcane Style' },
    { name: 'lazyup', display: '✨ LazyUp v2' },
    { name: 'S1_Dramatic_Lighting_v3', display: '💡 Dramatic Light' }
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
    `*Commands:*\n` +
    `/test <prompt> - Quick test ohne LoRAs\n` +
    `/checkmodel - Welches Model ist geladen?\n` +
    `/settings - Alle Einstellungen\n` +
    `/debug - Debug Info\n\n` +
    `*Tipp:* Model in A1111 GUI wählen, Bot nutzt es automatisch!`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/checkmodel/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const response = await axios.get(`${A1111_URL}/sdapi/v1/options`, { timeout: 5000 });
    const currentModel = response.data.sd_model_checkpoint;
    const currentVAE = response.data.sd_vae;
    
    bot.sendMessage(chatId,
      `📊 *A1111 Status*\n\n` +
      `Aktuell geladen:\n` +
      `• Model: ${currentModel}\n` +
      `• VAE: ${currentVAE}\n\n` +
      `Bot Config:\n` +
      `• Model: ${DEFAULT_CONFIG.checkpoint}\n` +
      `• VAE: ${DEFAULT_CONFIG.vae}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    bot.sendMessage(chatId, `❌ A1111 nicht erreichbar: ${err.message}`);
  }
});

bot.onText(/\/debug/, (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  
  // Count selected LoRAs
  let totalLoras = 0;
  let loraDetails = '';
  
  for (const [category, indices] of Object.entries(session.selections)) {
    if (indices.length > 0) {
      totalLoras += indices.length;
      const items = LORA_CATEGORIES[category];
      const names = indices.map(idx => items[idx].name);
      loraDetails += `${category}: ${names.join(', ')}\n`;
    }
  }
  
  bot.sendMessage(chatId,
    `🐛 *Debug Info*\n\n` +
    `wizardActive: ${session.wizardActive}\n` +
    `currentStep: ${session.currentStep}\n` +
    `stepName: ${WIZARD_STEPS[session.currentStep]}\n\n` +
    `Selected LoRAs: ${totalLoras}\n\n` +
    `${loraDetails || 'Keine LoRAs ausgewählt'}`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/setmodel (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const modelName = match[1];
  
  DEFAULT_CONFIG.checkpoint = modelName;
  
  let hint = '';
  
  // Auto-detect VAE based on model type
  if (modelName.toLowerCase().includes('xl') || modelName.toLowerCase().includes('nova') || modelName.toLowerCase().includes('pony')) {
    // XL Model → XL VAE
    DEFAULT_CONFIG.vae = 'sdxl_vae.safetensors';
    DEFAULT_CONFIG.width = 832;
    DEFAULT_CONFIG.height = 1216;
    hint = '\n\n📐 Auto: XL VAE + 832x1216 gesetzt';
  } else {
    // SD 1.5 Model → SD 1.5 VAE
    DEFAULT_CONFIG.vae = 'vae-ft-mse-840000-ema-pruned.safetensors';
    DEFAULT_CONFIG.width = 512;
    DEFAULT_CONFIG.height = 640;
    hint = '\n\n📐 Auto: SD 1.5 VAE + 512x640 gesetzt';
  }
  
  bot.sendMessage(chatId, `✅ Model gesetzt: ${modelName}${hint}\n\nWird bei der nächsten Generierung geladen!`);
});

bot.onText(/\/setvae (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const vaeName = match[1];
  
  DEFAULT_CONFIG.vae = vaeName;
  
  bot.sendMessage(chatId, `✅ VAE gesetzt: ${vaeName}\n\nWird bei der nächsten Generierung geladen!`);
});

// Quick switches für häufige Models
bot.onText(/\/nova/, (msg) => {
  const chatId = msg.chat.id;
  DEFAULT_CONFIG.checkpoint = 'novaAnimeXL_illV180.safetensors';
  DEFAULT_CONFIG.vae = 'sdxl_vae.safetensors';
  DEFAULT_CONFIG.width = 832;
  DEFAULT_CONFIG.height = 1216;
  bot.sendMessage(chatId, '✅ Switched to NovaAnime XL (832x1216)');
});

bot.onText(/\/aom3/, (msg) => {
  const chatId = msg.chat.id;
  DEFAULT_CONFIG.checkpoint = 'AOM3.safetensors';
  DEFAULT_CONFIG.vae = 'vae-ft-mse-840000-ema-pruned.safetensors';
  DEFAULT_CONFIG.width = 512;
  DEFAULT_CONFIG.height = 640;
  bot.sendMessage(chatId, '✅ Switched to AOM3 (512x640)');
});

// Simple test ohne LoRAs
bot.onText(/\/test (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];
  
  try {
    const statusMsg = await bot.sendMessage(chatId, '🧪 Test-Generierung (KEINE LoRAs)...');
    
    const payload = {
      prompt: prompt,
      negative_prompt: "ugly, blurry, bad quality",
      steps: 20,
      cfg_scale: 7,
      width: 512,
      height: 512,
      sampler_name: "DPM++ 2M Karras",
      seed: -1
    };
    
    console.log('[TEST] Sending simple request:', payload);
    
    const response = await axios.post(
      `${A1111_URL}/sdapi/v1/txt2img`,
      payload,
      { timeout: 120000 }
    );
    
    const imageBase64 = response.data.images[0];
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    await bot.deleteMessage(chatId, statusMsg.message_id);
    await bot.sendPhoto(chatId, imageBuffer, {
      caption: `🧪 Test: ${prompt}\n512x512, 20 steps, KEINE LoRAs`
    });
    
    console.log('[TEST] Success!');
    
  } catch (err) {
    console.error('[TEST] Failed:', err.message);
    bot.sendMessage(chatId, `❌ Test failed: ${err.message}`);
  }
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
    `• Seed: ${DEFAULT_CONFIG.seed === -1 ? 'Random' : DEFAULT_CONFIG.seed}\n\n` +
    `Zum Ändern:\n` +
    `/setmodel <name> - Model wechseln\n` +
    `/setvae <name> - VAE wechseln`
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
  
  console.log(`[WIZARD] Chat ${chatId} - Step ${session.currentStep}: ${stepName}`);
  
  // Final step: Prompt input
  if (stepName === 'prompt') {
    const summary = getSelectionSummary(session);
    
    console.log(`[WIZARD] Showing prompt step. Summary: ${summary}`);
    
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
    
    console.log(`[WIZARD] Next clicked. New step: ${session.currentStep} (${WIZARD_STEPS[session.currentStep]})`);
    
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
  
  console.log(`[MESSAGE] Chat ${chatId}: "${text}"`);
  
  // Ignore commands
  if (!text || text.startsWith('/')) {
    console.log(`  → Ignored (command or empty)`);
    return;
  }
  
  const session = getSession(chatId);
  console.log(`  → Session state: wizardActive=${session.wizardActive}, currentStep=${session.currentStep}/${WIZARD_STEPS.length-1}`);
  
  // Check if waiting for prompt in wizard
  if (session.wizardActive && WIZARD_STEPS[session.currentStep] === 'prompt') {
    console.log(`  → Wizard prompt detected! Generating...`);
    
    // Generate with selections
    await generateImage(chatId, text);
    
    // Reset wizard
    resetWizard(chatId);
    
    return;
  }
  
  // Direct prompt (no wizard active)
  if (!session.wizardActive) {
    console.log(`  → Direct prompt (no wizard). Generating...`);
    await generateImage(chatId, text);
  } else {
    console.log(`  → Ignored (wizard active but not on prompt step)`);
  }
});

// ==================== IMAGE GENERATION ====================

async function generateImage(chatId, prompt) {
  try {
    const statusMsg = await bot.sendMessage(chatId, '🎨 Generiere Bild...');
    
    console.log(`[${new Date().toISOString()}] User prompt: "${prompt}"`);
    
    // 1. Set Model/VAE BEFORE generation (if configured)
    if (DEFAULT_CONFIG.checkpoint && DEFAULT_CONFIG.checkpoint !== "") {
      try {
        console.log(`[API] Setting checkpoint: ${DEFAULT_CONFIG.checkpoint}, VAE: ${DEFAULT_CONFIG.vae || 'default'}`);
        
        const options = {
          sd_model_checkpoint: DEFAULT_CONFIG.checkpoint
        };
        
        // Nur VAE setzen wenn angegeben
        if (DEFAULT_CONFIG.vae && DEFAULT_CONFIG.vae !== "") {
          options.sd_vae = DEFAULT_CONFIG.vae;
        }
        
        await axios.post(
          `${A1111_URL}/sdapi/v1/options`,
          options,
          { timeout: 60000 }  // 60s für Model-Loading
        );
        
        console.log(`[API] Model/VAE set successfully`);
        
        // Wait for model to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`[API] Waited 3s for model loading`);
        
      } catch (err) {
        console.warn(`[API] Failed to set model/VAE: ${err.message}`);
        // Continue anyway - use whatever model is loaded
        console.log(`[API] Continuing with currently loaded model`);
      }
    } else {
      console.log(`[API] No model switching - using currently loaded model in A1111`);
    }
    
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
    
    // Count LoRAs
    const loraCount = (fullPrompt.match(/<lora:/g) || []).length;
    console.log(`[${new Date().toISOString()}] Total LoRAs in prompt: ${loraCount}`);
    
    // API Request
    const payload = {
      prompt: fullPrompt,
      negative_prompt: DEFAULT_CONFIG.negative_prompt,
      steps: DEFAULT_CONFIG.steps,
      cfg_scale: DEFAULT_CONFIG.cfg_scale,
      width: DEFAULT_CONFIG.width,
      height: DEFAULT_CONFIG.height,
      sampler_name: DEFAULT_CONFIG.sampler_name,
      seed: DEFAULT_CONFIG.seed
      
      // Note: Model/VAE wird jetzt VOR der Generation via /sdapi/v1/options gesetzt
      // Kein override_settings mehr nötig (A1111 ignoriert es manchmal)
    };
    
    const response = await axios.post(
      `${A1111_URL}/sdapi/v1/txt2img`,
      payload,
      { timeout: 300000 } // 5 Minuten (viele LoRAs brauchen Zeit!)
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
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    
    let errorMsg = '❌ Fehler beim Generieren:\n\n';
    
    if (error.code === 'ECONNREFUSED') {
      errorMsg += '🔴 Automatic1111 ist nicht erreichbar!\n';
      errorMsg += `Stelle sicher, dass A1111 auf ${A1111_URL} läuft.`;
    } else if (error.code === 'ECONNRESET') {
      errorMsg += '⚠️ Verbindung zu A1111 abgebrochen!\n\n';
      errorMsg += 'Mögliche Ursachen:\n';
      errorMsg += '• Zu viele LoRAs → Reduziere Auswahl\n';
      errorMsg += '• A1111 crashed → Check A1111 Console\n';
      errorMsg += '• LoRA nicht gefunden → Check Namen\n';
      errorMsg += '• VRAM voll → Niedrigere Auflösung';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMsg += '⏱️ Timeout nach 5 Minuten!\n\n';
      errorMsg += 'Generierung dauert zu lange.\n';
      errorMsg += '• Wähle weniger LoRAs\n';
      errorMsg += '• Reduziere Steps (aktuell: ' + DEFAULT_CONFIG.steps + ')';
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
