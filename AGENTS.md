# AGENTS.md

## Project Overview

**Interview Coder CN (Voice Enhanced)** is a desktop application forked from [yiport/interview-coder-cn](https://github.com/yiport/interview-coder-cn). It captures screenshots of coding problems and uses AI (vision models) to generate solutions in real-time. The window is invisible to screen-sharing software.

This fork adds a complete voice interaction system: TTS (text-to-speech) for reading AI answers aloud, voice conversation mode (speak to AI without screenshots), microphone input support, and chat-style conversation display.

Key capabilities:
- Global shortcuts trigger screenshot capture → AI analysis → streamed solution display
- Frameless, transparent, always-on-top overlay window invisible to screen-sharing
- Mouse passthrough mode (window ignores mouse events)
- Multi-screenshot conversation continuity (append screenshots to existing context)
- Follow-up questions within the same conversation
- Real-time speech transcription (DashScope Fun-ASR) — transcribed text is attached to screenshots when sent to AI
- **NEW: TTS (Text-to-Speech)** — AI answers read aloud via Web Speech API or DashScope CosyVoice
- **NEW: Voice conversation mode** — speak questions without screenshots (Alt+Z to toggle)
- **NEW: Microphone input** — audio source selectable between system audio and microphone
- **NEW: Chat-style display** — user voice messages and AI responses shown as conversation bubbles
- **NEW: Conversation export** — download full conversation history as Markdown
- Configurable AI provider (OpenAI, SiliconFlow, DeepSeek, OpenRouter, or any OpenAI-compatible API)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 37 (electron-vite 4) |
| Frontend | React 19, TypeScript 5.8 |
| Styling | Tailwind CSS v4, shadcn/ui (New York style), Radix primitives |
| State | Zustand 5 (6 stores, 2 with localStorage persistence) |
| Routing | react-router v7 (HashRouter, 3 routes) |
| AI | Vercel AI SDK (`ai` + `@ai-sdk/openai`), streaming via `streamText()` |
| STT | DashScope Fun-ASR (WebSocket, PCM 16kHz) |
| TTS | Web Speech API (free) + DashScope CosyVoice (WebSocket, PCM 24kHz) |
| Build | electron-vite (Vite 7), electron-builder 25 |
| Linting | ESLint 9 (flat config), Prettier |

## Directory Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry: lifecycle, error handling, app.whenReady()
│   ├── main-window.ts       # BrowserWindow creation (frameless, transparent, always-on-top)
│   ├── shortcuts.ts         # Global shortcuts + AI streaming orchestration + voice query handler
│   ├── ai.ts                # Vercel AI SDK integration, 4 streaming functions (incl. getVoiceStream)
│   ├── settings.ts          # App settings object + IPC handlers
│   ├── state.ts             # App state object + IPC handlers
│   ├── take-screenshot.ts   # desktopCapturer → base64 PNG
│   ├── transcription.ts     # DashScope WebSocket real-time speech-to-text (Fun-ASR)
│   ├── tts.ts               # DashScope WebSocket text-to-speech (CosyVoice)
│   ├── auto-updater.ts      # electron-updater (non-macOS only)
│   ├── prompts.md           # System prompt for AI (copied to build output via vite-plugin-static-copy)
│   └── index.d.ts           # global.mainWindow type declaration
├── preload/
│   ├── index.ts             # contextBridge API: exposes window.api to renderer
│   └── index.d.ts           # Type declarations for window.electron and window.api
└── renderer/
    ├── index.html            # SPA entry
    └── src/
        ├── main.tsx          # React root render
        ├── App.tsx           # Router + settings sync + shortcut init + Toaster
        ├── coder/            # Main page: screenshot display + AI solution stream
        │   ├── index.tsx     # CoderPage layout + state sync + transcription/TTS lifecycle + voice mode
        │   ├── AppHeader.tsx # Draggable title bar with nav buttons
        │   ├── AppContent.tsx# Screenshots gallery + markdown solution + error banner + auto-scroll
        │   ├── AppStatusBar.tsx    # Loading indicator, follow-up/export/TTS controls, voice mode indicator
        │   ├── TranscriptionBar.tsx # Absolute-positioned real-time transcription overlay
        │   └── PrerequisitesChecker.tsx  # Modal for API key setup
        ├── settings/         # Settings page
        │   ├── index.tsx     # AI config, TTS config, audio source, coding, appearance, shortcuts, privacy
        │   ├── SelectLanguage.tsx  # Combobox with custom language input
        │   ├── SelectModel.tsx     # Combobox with custom model input
        │   └── CustomShortcuts.tsx # Shortcut key recorder (incl. voice category)
        ├── help/             # Help page
        │   ├── index.tsx     # Quick start guide, shortcuts, FAQ
        │   ├── Shortcuts.tsx
        │   ├── FAQ.tsx
        │   └── components/index.tsx  # HelpSection wrapper
        ├── components/
        │   ├── MarkdownRenderer.tsx   # react-markdown + remark-gfm + rehype-highlight
        │   ├── ShortcutRenderer.tsx   # Platform-aware shortcut key badges
        │   └── ui/           # shadcn/ui primitives (button, dialog, select, etc.)
        ├── lib/
        │   ├── store/        # Zustand stores
        │   │   ├── app.ts       # ignoreMouse state
        │   │   ├── settings.ts  # API config, model, language, opacity, TTS, audio source (persisted v5)
        │   │   ├── shortcuts.ts # Shortcut bindings (persisted v5, with voice shortcuts)
        │   │   ├── solution.ts  # Loading state, solution chunks, screenshots, errors
        │   │   ├── transcription.ts # Transcription state: isTranscribing, text, error
        │   │   └── voice.ts     # Voice mode state: isVoiceMode, isTTSEnabled, isSpeaking
        │   ├── audio-capture.ts    # Audio capture (system audio or microphone → 16kHz PCM)
        │   ├── speech-synthesis.ts # Web Speech API TTS wrapper
        │   ├── tts-player.ts       # PCM audio player (Web Audio API, 24kHz)
        │   ├── tts.ts              # TTS orchestrator (selects provider, unified speak/stop API)
        │   └── utils/
        │       ├── index.ts     # cn() helper, getCloneableFields()
        │       ├── env.ts       # isMac, platformAlt
        │       └── keyboard.ts  # Accelerator string conversion
        └── assets/
            ├── base.css      # Tailwind @import, CSS variables, app layout styles
            └── main.css      # Tailwind + typography plugin + theme variables (oklch)
```

## Architecture

### Process Model

```
┌──────────────────────────────────────────────────────────────────┐
│  Main Process (src/main/)                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐  │
│  │ settings │  │  state   │  │    shortcuts.ts               │  │
│  │   .ts    │  │   .ts    │  │  (orchestrator)               │  │
│  └────┬─────┘  └────┬─────┘  │  - global hotkeys             │  │
│       │              │        │  - AI streaming (4 functions) │  │
│       │              │        │  - voice query handler        │  │
│       │              │        │  - conversation management    │  │
│       │              │        └──┬───────────┬──────┬────────┘  │
│       │              │           │           │      │           │
│       │              │     ┌─────┴──┐  ┌─────┴──┐ ┌─┴────────┐ │
│       │              │     │ ai.ts  │  │take-   │ │tts.ts     │ │
│       │              │     │(4 func)│  │screensh│ │transcrip. │ │
│       │              │     └────────┘  └────────┘ └──────────┘ │
│       └──────────────┼───────────┘                              │
│              IPC (ipcMain.handle)                                │
├──────────────────────────────────────────────────────────────────┤
│  Preload (src/preload/)                                          │
│  contextBridge → window.api                                      │
├──────────────────────────────────────────────────────────────────┤
│  Renderer (src/renderer/)                                        │
│  React app with 6 Zustand stores                                 │
│  window.api.on*() for events from main                           │
│  window.api.*() for invoke calls to main                         │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow: Screenshot → Solution

1. User presses global shortcut (e.g., `Alt+Enter`)
2. `shortcuts.ts` callback triggers `takeScreenshot()` → `desktopCapturer` → base64 PNG
3. Main sends `screenshot-taken` and `ai-loading-start` to renderer
4. Main calls `getSolutionStream(base64Image)` → Vercel AI SDK `streamText()`
5. Stream chunks sent to renderer via `solution-chunk` IPC events
6. Renderer accumulates chunks in `useSolutionStore` and renders via `MarkdownRenderer`
7. On completion: `solution-complete` + `tts-speak-text` (clean AI response for TTS)

### Voice Conversation Flow

1. User presses `Alt+Z` → main sends `toggle-voice-conversation` to renderer
2. Renderer starts mic capture → PCM chunks → main transcription WebSocket
3. Transcription text displayed in `TranscriptionBar` in real-time
4. User presses `Alt+Z` again → renderer stops capture, sends transcription text to main via `send-voice-query`
5. Main builds conversation, streams AI response via `getVoiceStream()`
6. User message and AI response displayed as chat bubbles (👤 / 🤖)
7. On completion: TTS reads the latest AI response aloud

### IPC Channels

**Renderer → Main (invoke):**
- `getAppSettings` / `updateAppSettings` — settings CRUD
- `updateAppState` — sync `inCoderPage`, `ignoreMouse`
- `initShortcuts` / `getShortcuts` / `updateShortcuts` — shortcut management
- `stopSolutionStream` — abort current AI stream
- `sendFollowUpQuestion` — follow-up within conversation
- `start-transcription` / `stop-transcription` — speech transcription lifecycle
- `get-transcription-text` / `clear-transcription-text` — read/clear accumulated text
- `start-tts` / `stop-tts` — DashScope TTS WebSocket lifecycle
- `tts-speak` — send text for TTS synthesis
- `send-voice-query` — start text-only AI streaming for voice conversation

**Main → Renderer (send):**
- `sync-app-state` — push state changes
- `screenshot-taken` / `screenshots-updated` — screenshot data
- `solution-clear` / `solution-chunk` / `solution-complete` / `solution-stopped` / `solution-error` — AI streaming lifecycle
- `ai-loading-start` / `ai-loading-end` — loading state
- `scroll-page-up` / `scroll-page-down` — keyboard-driven scroll
- `toggle-transcription` — trigger start/stop transcription from shortcut
- `transcription-text` / `transcription-error` / `transcription-stopped` / `transcription-cleared` — transcription events
- `tts-audio-chunk` / `tts-started` / `tts-complete` / `tts-error` — TTS events
- `tts-speak-text` — clean AI response text for TTS (no user messages/labels)
- `toggle-voice-conversation` / `toggle-tts` — shortcut-triggered toggles

### Zustand Stores

| Store | File | Persisted | Key State |
|-------|------|-----------|-----------|
| `useSettingsStore` | `lib/store/settings.ts` | Yes (v5) | `apiBaseURL`, `apiKey`, `model`, `customModels`, `codeLanguage`, `opacity`, `customPrompt`, `dashscopeApiKey`, `ttsProvider`, `ttsEnabled`, `audioSource`, `ttsVoice` |
| `useShortcutsStore` | `lib/store/shortcuts.ts` | Yes (v5) | `shortcuts` (14 actions incl. voiceQuery, toggleTTS) |
| `useSolutionStore` | `lib/store/solution.ts` | No | `isLoading`, `solutionChunks`, `screenshotData`, `errorMessage` |
| `useTranscriptionStore` | `lib/store/transcription.ts` | No | `isTranscribing`, `transcriptionText`, `errorMessage` |
| `useVoiceStore` | `lib/store/voice.ts` | No | `isVoiceMode`, `isTTSEnabled`, `isSpeaking` |
| `useAppStore` | `lib/store/app.ts` | No | `ignoreMouse` |

Settings are bidirectionally synced: renderer persists to localStorage, and on mount syncs to main process via `updateAppSettings()`. Main process `.env` values serve as initial defaults only.

## Key Patterns & Conventions

### Window Stealth

The app is designed to be invisible to screen-sharing software:
- `BrowserWindow` options: `transparent: true`, `frame: false`, `skipTaskbar: true`
- `setContentProtection(true)` prevents screen capture of the window itself
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })`
- `keepWindowInFront()` repeatedly reasserts always-on-top for 5 seconds after show
- `showInactive()` on macOS/Windows to avoid stealing focus

### AI Integration

- All AI calls go through `src/main/ai.ts` using Vercel AI SDK's `streamText()`
- Provider: `@ai-sdk/openai` with custom `baseURL` (works with any OpenAI-compatible API)
- Model fallback: `Qwen/Qwen3-VL-32B-Instruct` for SiliconFlow, `gpt-5-mini` otherwise
- System prompt is loaded from `prompts.md` at build time (bundled via `vite-plugin-static-copy`)
- Four streaming functions: `getSolutionStream` (first screenshot), `getFollowUpStream` (follow-up), `getGeneralStream` (multi-screenshot), `getVoiceStream` (voice-only conversation)
- Conversation history (`conversationMessages`) is maintained in `shortcuts.ts` as `ModelMessage[]`

### TTS System

- **Web Speech API** (free): Uses browser's built-in `SpeechSynthesis` API in the renderer. No IPC needed, works offline. Voice quality depends on OS.
- **DashScope CosyVoice** (paid): WebSocket-based TTS in main process (`src/main/tts.ts`). Receives text from renderer, returns PCM audio (24kHz Int16 mono) via `tts-audio-chunk` events. Played via Web Audio API in renderer (`tts-player.ts`).
- **Orchestrator** (`src/renderer/src/lib/tts.ts`): Single `speak()` / `stop()` API, selects provider based on `ttsProvider` setting.
- TTS only reads the latest AI response (clean text sent via `tts-speak-text` event), not user messages or conversation history.
- Listener cleanup is managed to prevent memory leaks across multiple TTS calls.

### Real-time Speech Transcription

- Uses DashScope (Alibaba Cloud) Fun-ASR real-time ASR via WebSocket (`src/main/transcription.ts`)
- Requires a separate `dashscopeApiKey` configured in settings
- Audio is captured from system audio (`getDisplayMedia`) or microphone (`getUserMedia`), selectable via `audioSource` setting
- Downsampled to 16kHz PCM, and streamed to main process via IPC
- `TranscriptionBar` is absolute-positioned at the top of the coder page, shows up to 3 lines with auto-scroll
- On screenshot or voice query, accumulated transcription text is automatically attached to the AI prompt, then cleared
- `clearTranscription` shortcut clears text without submitting to AI

### Voice Conversation Mode

- Triggered by `Alt+Z` shortcut or settings UI
- Captures audio (system or mic), transcribes via DashScope, sends text-only to AI via `getVoiceStream()`
- Uses a conversational system prompt optimized for spoken dialogue
- Responses displayed in chat format (👤 user bubble + 🤖 AI label)
- TTS auto-plays the AI response after completion
- Conversation history is preserved across voice queries for follow-up support

### Chat-Style Display

- User messages shown as: `> **👤 你（语音）：** {transcribed text}`
- User follow-up questions shown as: `> **👤 你：** {question}`
- AI responses prefixed with: `**🤖 AI：**`
- All messages accumulate in the solution display area as a continuous conversation
- Auto-scroll keeps the latest content visible during streaming
- Export button downloads full conversation as `.md` file

### Stream Abort Pattern

- `StreamContext` with `AbortController` and `reason` (`'user'` | `'new-request'`)
- New requests automatically abort previous streams
- User can manually stop via shortcut or UI button
- Abort reason determines which IPC event to send (`solution-stopped` for user, silent for new-request)

### Shortcut System

- Global shortcuts registered via Electron's `globalShortcut` API
- 14 shortcut actions across 6 categories (Window Management, Screenshot & AI, Voice, Navigation, Window Movement)
- Renderer stores shortcut config in Zustand (persisted); sends to main on init
- On Windows, `Alt`-based shortcuts also register `Ctrl+Alt` variant for compatibility
- Voice-related shortcuts (`voiceQuery`, `toggleTTS`) are disabled in settings when `dashscopeApiKey` is not configured

### UI Component Patterns

- shadcn/ui components in `src/renderer/src/components/ui/` — do NOT edit these directly, use the shadcn CLI to add/update
- `cn()` utility (clsx + tailwind-merge) for conditional class merging
- `getCloneableFields()` strips functions from store state before sending over IPC
- Platform-aware shortcut display via `ShortcutRenderer` (⌘, ⌥, ⇧ on Mac; Ctrl, Alt, Shift on Windows)

## Development

### Commands

```bash
npm install          # Install dependencies
npm run dev          # Start in dev mode (electron-vite dev)
npm run build        # Typecheck + build (electron-vite build)
npm run build:mac    # Build macOS distributable
npm run build:win    # Build Windows distributable
npm run typecheck    # Run TypeScript type checking (node + web)
npm run lint         # Run ESLint
npm run format       # Run Prettier
```

### Configuration

The `.env` file at project root configures the AI provider:

```env
API_BASE_URL="https://api.deepseek.com/v1"   # OpenAI-compatible API endpoint
API_KEY="sk-..."                                # API key
MODEL="deepseek-v4-pro"                         # Optional: override default model
```

These are read by dotenv in the main process and merged with renderer-side settings (renderer settings take priority when set).

### Path Aliases

- `@renderer/*` and `@/*` both resolve to `src/renderer/src/*`
- Configured in `tsconfig.web.json` and `electron.vite.config.ts`

### Code Style

- Prettier: single quotes, no semicolons, 100 char print width, no trailing commas
- ESLint: TypeScript + React + React Hooks + React Refresh rules
- UI text and user-facing strings are in **Chinese** (中文)
- Code comments and variable names are in **English**

## Important Notes for AI Agents

1. **Three TypeScript configs**: `tsconfig.node.json` (main + preload), `tsconfig.web.json` (renderer). The root `tsconfig.json` is a project references file only.

2. **`prompts.md` is bundled**: It lives in `src/main/` but gets copied to the build output via `vite-plugin-static-copy`. Loaded at runtime with `readFileSync(join(import.meta.dirname, 'prompts.md'))`.

3. **`global.mainWindow`**: The main window reference is stored as a global variable, declared in `src/main/index.d.ts`.

4. **Settings flow**: `.env` → main process `settings` object → renderer reads on mount via IPC → renderer persists to localStorage via Zustand. Renderer-side changes are sent back to main via `updateAppSettings`.

5. **No shared types directory**: Main process types (`AppSettings`, `AppState`) are imported directly by the preload script from `../main/settings` and `../main/state`. This works because preload shares the Node.js tsconfig.

6. **Streaming orchestration is in `shortcuts.ts`**: Despite the filename, this 900+ line file is the central orchestrator for global shortcuts, AI streaming (4 types), voice queries, and conversation management.

7. **Window movement**: The window can be moved via keyboard shortcuts in 200px steps (up/down/left/right).

8. **macOS auto-update is disabled**: `publish: null` in electron-builder.yml for mac target. Auto-update only works on Windows.

9. **TTS listener cleanup**: DashScope TTS listeners (onTTSAudioChunk, onTTSComplete, onTTSError) must be cleaned up after each TTS session to prevent memory leaks. The `tts.ts` orchestrator manages this with a `cleanupTTSListeners` function.

10. **Voice conversation reuses screenshot display**: Voice AI responses use the same `solutionChunks` store and `MarkdownRenderer` as screenshot responses. No separate UI needed — user messages and AI responses are formatted as chat bubbles within the existing solution display area.
