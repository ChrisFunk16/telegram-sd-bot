# Telegram Stable Diffusion Bot

Telegram Bot für Bildergeneration über Automatic1111.

## Features

- ✅ Einfache Prompts → Bilder generieren
- ✅ Vorkonfigurierte Settings (Steps, CFG, Size)
- ✅ Negative Prompts automatisch
- ✅ Direct Messages = Prompts (kein `/generate` nötig)

## Setup

### 1. Bot-Token erstellen

1. Öffne Telegram und suche nach `@BotFather`
2. Sende `/newbot`
3. Folge den Anweisungen (Name + Username vergeben)
4. Kopiere den Bot-Token

### 2. Installation

```bash
cd telegram-sd-bot
npm install
```

### 3. Konfiguration

Erstelle `.env` Datei:

```bash
cp .env.example .env
```

Trage deinen Bot-Token ein:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
A1111_URL=http://127.0.0.1:7860
```

### 4. Automatic1111 starten

Stelle sicher, dass Automatic1111 läuft:

```bash
# In deinem A1111 Ordner
./webui.sh --api
```

Wichtig: `--api` Flag aktiviert die API!

### 5. Bot starten

```bash
npm start
```

Du solltest sehen: `🤖 Telegram SD Bot gestartet!`

## Nutzung

### Commands

- `/start` - Bot starten & Willkommensnachricht
- `/generate <prompt>` - Bild generieren
- `/settings` - Aktuelle Einstellungen anzeigen
- `/help` - Hilfe

### Direkte Prompts

Schreib einfach direkt in den Chat:

```
a cat in space
```

Der Bot generiert automatisch ein Bild!

## Standard-Einstellungen

```javascript
{
  steps: 30,
  cfg_scale: 7,
  width: 512,
  height: 512,
  sampler_name: "Euler a",
  negative_prompt: "ugly, blurry, bad quality, distorted, deformed",
  seed: -1,  // Random
  loras: [
    { name: "yuki_lora", weight: 0.7 }  // LoRA Name + Stärke (0.0-1.0)
  ],
  default_prompt_prefix: "yukichar, 1girl, purple hair"  // Standard-Tags vor jedem Prompt
}
```

Diese kannst du in `bot.js` unter `DEFAULT_CONFIG` anpassen.

### Default Prompt Prefix

Der Bot fügt automatisch einen Prefix vor JEDEN User-Prompt ein:

**Beispiel:**
- User schreibt: `sitting on a bench`
- Tatsächlicher Prompt: `<lora:yuki_lora:0.7> yukichar, 1girl, purple hair, sitting on a bench`

So musst du nicht jedes Mal die Character-Tags eingeben! Passe den `default_prompt_prefix` in der Config an oder setze ihn auf `null` um ihn zu deaktivieren.

### LoRA Support

Der Bot unterstützt LoRAs! Füge sie in der Config hinzu:

```javascript
loras: [
  { name: "yuki_lora", weight: 0.7 },
  { name: "another_lora", weight: 0.6 }
]
```

**Wichtig:** Der Name muss EXAKT dem Dateinamen in deinem A1111 `models/Lora/` Ordner entsprechen (ohne `.safetensors`).

**Weight:** 0.0 - 1.0 (Standard: 0.7-0.8)
- Höher = stärkerer Einfluss
- Niedriger = subtiler

Die LoRAs werden automatisch in jeden Prompt eingebaut: `<lora:yuki_lora:0.7> your prompt here`

## Troubleshooting

### "Automatic1111 ist nicht erreichbar!"

- Stelle sicher, dass A1111 läuft: `http://127.0.0.1:7860`
- Prüfe ob `--api` Flag gesetzt ist
- Teste manuell: `curl http://127.0.0.1:7860/sdapi/v1/txt2img`

### "Polling error"

- Bot-Token falsch? Prüfe `.env`
- Telegram-API blockiert? VPN nutzen

### Bot antwortet nicht

- Ist der Bot gestartet? (`npm start`)
- Logs checken in der Konsole

## Erweiterungen (später)

- [ ] Settings per Command ändern (`/cfg 9`, `/steps 50`)
- [ ] Mehrere Bilder auf einmal
- [ ] Custom Negative Prompts
- [ ] Model-Wechsel
- [ ] ControlNet Integration
- [ ] Bild-zu-Bild (img2img)

## Logs

Der Bot loggt alle Generierungen:

```
[2026-04-27T16:30:45.123Z] Generating: "a cat in space"
[2026-04-27T16:30:52.456Z] ✅ Image sent to chat 123456789
```
