# Character LoRA Setup

Dein Bot ist aktuell **ohne Character LoRA** konfiguriert. So aktivierst du eins:

## 1. LoRA-Datei finden

Öffne deinen A1111 Ordner:
```
stable-diffusion-webui/models/Lora/
```

Schau welche LoRA-Dateien du hast, z.B.:
- `yuki_character_v1.safetensors`
- `my_character.safetensors`

**Wichtig:** Der Name **ohne** `.safetensors`!

## 2. Bot-Config anpassen

Öffne `bot.js` und suche:

```javascript
loras: [
  // { name: "yuki_lora", weight: 0.8 }  // DEAKTIVIERT
],
default_prompt_prefix: ""  // Leer
```

**Ändere zu:**

```javascript
loras: [
  { name: "yuki_character_v1", weight: 0.8 }  // ← Dein LoRA-Name!
],
default_prompt_prefix: "yukichar, 1girl, purple hair, cat ears"  // ← Trigger-Words!
```

**Namen anpassen:**
- `name`: Exakt wie Dateiname (ohne .safetensors)
- `weight`: 0.7-1.0 (höher = stärker)
- `default_prompt_prefix`: Trigger-Words aus dem LoRA

## 3. Trigger-Words finden

**Wo stehen die?**
- Auf Civitai (wenn du es runtergeladen hast)
- In der Datei-Beschreibung
- Im Training-Prompt

**Beispiele:**
```
yukichar, 1girl, purple hair, cat ears
mychar, solo, blue eyes
charactername, long hair, school uniform
```

## 4. Bot neu starten

```bash
# Bot stoppen (Strg+C)
node bot.js
```

**Jetzt wird bei JEDER Generierung automatisch dein Character LoRA geladen!**

## 5. Test

```
/generate
→ Alle Kategorien skippen (nur "Weiter" klicken)
→ Prompt: "standing, smiling"
```

**Sollte deinen Character zeigen!**

## Mehrere Character LoRAs

```javascript
loras: [
  { name: "main_character", weight: 0.9 },
  { name: "style_lora", weight: 0.6 }
],
```

## Troubleshooting

**"LoRA not found" Error:**
- Name stimmt nicht → Check exakte Schreibweise
- Datei fehlt → In `models/Lora/` kopieren
- A1111 neu starten → LoRAs werden beim Start geladen

**Character sieht falsch aus:**
- `weight` erhöhen (0.8 → 1.0)
- Trigger-Words fehlen → `default_prompt_prefix` anpassen
- LoRA passt nicht zum Base Model (SD 1.5 LoRA auf XL Model)

**Console Check:**
```
[2026-04-28...] Full prompt: "<lora:yuki_character_v1:0.8> yukichar, 1girl, ..."
```
→ Siehst du dein LoRA im Prompt? ✅ Korrekt konfiguriert!
