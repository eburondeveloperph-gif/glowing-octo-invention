<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Orbit Translator — Pharmacy Counter

Real-time bidirectional speech translator for pharmacy counter interactions.
Staff speaks Dutch (Flemish); guest language is auto-detected.

## How it works

1. Staff presses **Start Gesprek**
2. The app greets the guest and invites them to speak
3. Guest language is auto-detected from first utterance
4. Live bidirectional translation runs via Gemini Live API

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```
   npm install
   ```
2. Set `GEMINI_API_KEY` in `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Run the app:
   ```
   npm run dev
   ```

## Testing

```
npm test          # single run
npm run test:watch # watch mode
```
