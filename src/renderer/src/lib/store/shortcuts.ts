import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isMac, platformAlt } from '../utils/env'

export type Shortcut = {
  action: string
  key: string
  defaultKey: string
  category: string
  status?: ShortcutStatus
}

export enum ShortcutStatus {
  Registered = 'registered',
  Failed = 'failed',
  /** Shortcut is available to register but not registered. */
  Available = 'available'
}

interface ShortcutsState {
  shortcuts: Record<string, Shortcut>
}

interface ShortcutsStore extends ShortcutsState {
  updateShortcut: (action: string, shortcut: Shortcut) => void
  updateShortcuts: (shortcuts: Record<string, Shortcut>) => void
  resetShortcuts: () => void
}

type PersistedShortcutsState = {
  shortcuts?: Record<string, Shortcut>
}

function isPersistedShortcutsState(value: unknown): value is PersistedShortcutsState {
  return typeof value === 'object' && value !== null && 'shortcuts' in value
}

const defaultShortcuts: Record<string, Omit<Shortcut, 'defaultKey'>> = {
  hideOrShowMainWindow: {
    action: 'hideOrShowMainWindow',
    key: `${platformAlt}+H`,
    category: 'Window Management'
  },
  ignoreOrEnableMouse: {
    action: 'ignoreOrEnableMouse',
    key: `${platformAlt}+M`,
    category: 'Window Management'
  },
  takeScreenshot: {
    action: 'takeScreenshot',
    key: `${platformAlt}+Enter`,
    category: 'Screenshot & AI'
  },
  appendScreenshot: {
    action: 'appendScreenshot',
    key: `${platformAlt}+Shift+Enter`,
    category: 'Screenshot & AI'
  },
  stopSolutionStream: {
    action: 'stopSolutionStream',
    key: `${platformAlt}+.`,
    category: 'Screenshot & AI'
  },
  alternativeSolution: {
    action: 'alternativeSolution',
    key: 'CommandOrControl+/',
    category: 'Screenshot & AI'
  },
  codeIdea: {
    action: 'codeIdea',
    key: 'CommandOrControl+I',
    category: 'Screenshot & AI'
  },
  toggleResponseMode: {
    action: 'toggleResponseMode',
    key: 'CommandOrControl+Shift+M',
    category: 'Screenshot & AI'
  },
  toggleTranscription: {
    action: 'toggleTranscription',
    key: `${platformAlt}+T`,
    category: 'Screenshot & AI'
  },
  clearTranscription: {
    action: 'clearTranscription',
    key: `${platformAlt}+Shift+T`,
    category: 'Screenshot & AI'
  },
  pageUp: { action: 'pageUp', key: 'CommandOrControl+J', category: 'Navigation' },
  pageDown: { action: 'pageDown', key: 'CommandOrControl+K', category: 'Navigation' },
  contentScrollUp: {
    action: 'contentScrollUp',
    key: 'CommandOrControl+Shift+J',
    category: 'Navigation'
  },
  contentScrollDown: {
    action: 'contentScrollDown',
    key: 'CommandOrControl+Shift+K',
    category: 'Navigation'
  },
  moveMainWindowUp: {
    action: 'moveMainWindowUp',
    key: 'CommandOrControl+Up',
    category: 'Window Movement'
  },
  moveMainWindowDown: {
    action: 'moveMainWindowDown',
    key: 'CommandOrControl+Down',
    category: 'Window Movement'
  },
  moveMainWindowLeft: {
    action: 'moveMainWindowLeft',
    key: 'CommandOrControl+Left',
    category: 'Window Movement'
  },
  moveMainWindowRight: {
    action: 'moveMainWindowRight',
    key: 'CommandOrControl+Right',
    category: 'Window Movement'
  },
  voiceQuery: {
    action: 'voiceQuery',
    key: 'CommandOrControl+Q',
    category: 'Voice'
  },
  toggleTTS: {
    action: 'toggleTTS',
    key: `${platformAlt}+B`,
    category: 'Voice'
  },
  startRecording: {
    action: 'startRecording',
    key: 'CommandOrControl+1',
    category: 'Voice'
  },
  stopRecording: {
    action: 'stopRecording',
    key: 'CommandOrControl+2',
    category: 'Voice'
  }
}

export const useShortcutsStore = create<ShortcutsStore>()(
  persist(
    (set) => ({
      shortcuts: Object.fromEntries(
        Object.entries(defaultShortcuts).map(([action, shortcut]) => [
          action,
          { ...shortcut, defaultKey: shortcut.key }
        ])
      ),
      updateShortcut: (action, shortcut) => {
        set((state) => ({
          shortcuts: {
            ...state.shortcuts,
            [action]: shortcut
          }
        }))
      },
      updateShortcuts: (shortcuts) => {
        set({ shortcuts })
      },
      resetShortcuts: () => {
        set({
          shortcuts: Object.fromEntries(
            Object.entries(defaultShortcuts).map(([action, shortcut]) => [
              action,
              { ...shortcut, defaultKey: shortcut.key }
            ])
          )
        })
      }
    }),
    {
      name: 'interview-coder-shortcuts',
      version: 10,
      migrate: (state: unknown, version: number) => {
        if (!isPersistedShortcutsState(state) || !state.shortcuts) return state as ShortcutsStore
        // Merge in any new default shortcuts that are missing
        const defaults = Object.fromEntries(
          Object.entries(defaultShortcuts).map(([action, shortcut]) => [
            action,
            { ...shortcut, defaultKey: shortcut.key }
          ])
        )
        // Remove obsolete shortcut keys that no longer exist in defaults
        const cleaned: Record<string, Shortcut> = {}
        for (const [action, shortcut] of Object.entries(state.shortcuts)) {
          if (defaults[action]) {
            cleaned[action] = shortcut as Shortcut
          }
        }
        const merged = {
          ...state,
          shortcuts: {
            ...defaults,
            ...cleaned
          }
        } as ShortcutsStore

        // v2→v3: On Windows, migrate Alt shortcuts to CommandOrControl (Ctrl)
        if (version < 3 && !isMac) {
          for (const [action, shortcut] of Object.entries(merged.shortcuts)) {
            merged.shortcuts[action] = {
              ...shortcut,
              key: shortcut.key.replace(/\bAlt\b/g, 'CommandOrControl'),
              defaultKey: shortcut.defaultKey.replace(/\bAlt\b/g, 'CommandOrControl')
            }
          }
        }

        return merged
      }
    }
  )
)
