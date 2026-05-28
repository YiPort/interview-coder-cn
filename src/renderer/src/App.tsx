import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router'
import { Toaster } from 'sonner'
import CoderPage from '@/coder'
import SettingsPage from '@/settings'
import HelpPage from '@/help'
import { useSettingsStore } from '@/lib/store/settings'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useResumeStore } from '@/lib/store/resume'
import { getCloneableFields } from '@/lib/utils'

export default function App() {
  const [initialized, setInitialized] = useState(false)
  const settingsStore = useSettingsStore()
  const { shortcuts } = useShortcutsStore()

  useEffect(() => {
    window.api.getAppSettings().then((settings) => {
      const blankFields = Object.keys(settings).filter(
        (key) => settings[key] && !settingsStore[key]
      )
      settingsStore.syncSettings(
        blankFields.reduce(
          (acc, key) => {
            acc[key] = settings[key]
            return acc
          },
          {} as Partial<typeof settingsStore>
        )
      )
      setInitialized(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (initialized) {
      window.api.updateAppSettings(getCloneableFields(settingsStore))
      useResumeStore.getState().syncToMain()
    }
  }, [initialized, settingsStore])

  useEffect(() => {
    window.api.initShortcuts(shortcuts)
    // Shortcuts edited in the settings page are pushed through updateShortcuts().
    // Keep initialization one-shot; re-initializing all global shortcuts on every
    // store change can unregister working shortcuts and leave the app non-interactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <HashRouter>
        <Routes>
          <Route index element={<CoderPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
        </Routes>
      </HashRouter>

      <Toaster />
    </>
  )
}
