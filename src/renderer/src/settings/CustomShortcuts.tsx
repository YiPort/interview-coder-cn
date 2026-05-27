import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { isModifierKey, getShortcutAccelerator } from '@/lib/utils/keyboard'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useSettingsStore } from '@/lib/store/settings'

const ShortcutsContext = createContext<{
  recordingAction: string | null
  setRecordingAction: (action: string | null) => void
}>({
  recordingAction: null,
  setRecordingAction: () => {}
})

export function CustomShortcuts() {
  const { shortcuts, updateShortcut } = useShortcutsStore()
  const { dashscopeApiKey, recordEnabled } = useSettingsStore()
  const [recordingAction, setRecordingAction] = useState<string | null>(null)

  const onShortcutChange = useCallback(
    (action: string, key: string) => {
      const newShortcut = { ...shortcuts[action], key }
      updateShortcut(action, newShortcut)
      window.api.updateShortcuts([newShortcut])
    },
    [shortcuts, updateShortcut]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction) return
      e.preventDefault()
      e.stopPropagation()
    },
    [recordingAction]
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction) return

      // Escape cancels recording
      if (e.code === 'Escape') {
        setRecordingAction(null)
        return
      }

      if (isModifierKey(e.code)) return

      const accelerator = getShortcutAccelerator(e)
      if (!accelerator) return

      onShortcutChange(recordingAction, accelerator)
      setRecordingAction(null)
    },
    [recordingAction, onShortcutChange]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  return (
    <ShortcutsContext.Provider value={{ recordingAction, setRecordingAction }}>
      <div className="space-y-4">
        {/* Window Management */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">窗口管理</h3>
          <Shortcut label="隐藏/显示窗口" shortcut="hideOrShowMainWindow" />
          <Shortcut
            label="鼠标穿透"
            description="启用后窗口对鼠标穿透，可以点击窗口背后的内容"
            shortcut="ignoreOrEnableMouse"
          />
        </div>

        {/* Screenshot & AI */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">截图与AI</h3>
          <Shortcut
            label="截图"
            description="截图并生成解题建议（会新开对话）"
            shortcut="takeScreenshot"
          />
          <Shortcut
            label="追加截图"
            description="在当前对话中追加截图并生成解题建议，适用于长题目等场景"
            shortcut="appendScreenshot"
          />
          <Shortcut
            label="另一种解法"
            description="对当前答案不满意时请求不同的解法"
            shortcut="alternativeSolution"
          />
          <Shortcut
            label="输出解题思路"
            description="基于当前题目输出适合面试口述的思路、步骤、边界和复杂度"
            shortcut="codeIdea"
          />
          <Shortcut
            label="切换回答模式"
            description="在核心代码、ACM、自定义提示词之间切换；未填写自定义提示词时会跳过自定义模式"
            shortcut="toggleResponseMode"
          />
          <Shortcut
            label="停止生成"
            description="打断当前正在生成的解题建议"
            shortcut="stopSolutionStream"
          />
          <Shortcut
            label="语音转录"
            description="开始/暂停实时语音转录"
            shortcut="toggleTranscription"
            disabled={!dashscopeApiKey}
          />
          <Shortcut
            label="清除转录文本"
            description="清除已转录的文本（不会提交给AI）"
            shortcut="clearTranscription"
            disabled={!dashscopeApiKey}
          />
        </div>

        {/* Voice */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">语音对话</h3>
          <Shortcut
            label="语音对话"
            description="开始/停止语音对话模式（无需截图即可与AI对话）"
            shortcut="voiceQuery"
            disabled={!dashscopeApiKey}
          />
          <Shortcut
            label="切换TTS朗读"
            description="开启/关闭AI答案语音朗读"
            shortcut="toggleTTS"
          />
          <Shortcut
            label="开始录音"
            description="开始双通道录音，同时录制面试官和自己"
            shortcut="startRecording"
            disabled={!dashscopeApiKey || !recordEnabled}
            disabledReason={
              !recordEnabled
                ? '（需先在录音设置中开启"启用面试录音"）'
                : !dashscopeApiKey
                  ? '（需配置百炼平台 API Key）'
                  : undefined
            }
          />
          <Shortcut
            label="停止录音"
            description="停止录音并保存记录文档"
            shortcut="stopRecording"
          />
        </div>

        {/* Navigation */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">页面导航</h3>
          <Shortcut label="向上翻页" shortcut="pageUp" />
          <Shortcut label="向下翻页" shortcut="pageDown" />
          <Shortcut
            label="内容框向上滚动"
            description="滚动当前可见的代码块/Markdown 内容框，适合鼠标穿透时查看长代码"
            shortcut="contentScrollUp"
          />
          <Shortcut
            label="内容框向下滚动"
            description="滚动当前可见的代码块/Markdown 内容框，适合鼠标穿透时查看长代码"
            shortcut="contentScrollDown"
          />
        </div>

        {/* Window Movement */}
        <div className="space-y-2">
          <h3 className="text-sm text-gray-500">窗口移动</h3>
          <Shortcut label="向上移动窗口" shortcut="moveMainWindowUp" />
          <Shortcut label="向下移动窗口" shortcut="moveMainWindowDown" />
          <Shortcut label="向左移动窗口" shortcut="moveMainWindowLeft" />
          <Shortcut label="向右移动窗口" shortcut="moveMainWindowRight" />
        </div>
      </div>
    </ShortcutsContext.Provider>
  )
}

function Shortcut({
  label,
  description,
  shortcut: shortcutAction,
  disabled,
  disabledReason
}: {
  label: string
  description?: string
  shortcut: string
  disabled?: boolean
  disabledReason?: string
}) {
  const { shortcuts } = useShortcutsStore()
  const { recordingAction, setRecordingAction } = useContext(ShortcutsContext)
  const shortcut = shortcuts[shortcutAction]
  const isRecording = recordingAction === shortcutAction

  return shortcut ? (
    <div
      className={`flex items-center justify-between${disabled ? ' opacity-40 pointer-events-none' : ''}`}
    >
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium">{label}</label>
        {description && <p className="text-xs font-light">{description}</p>}
        {disabledReason && (
          <p className="text-xs text-amber-600 font-light">{disabledReason}</p>
        )}
      </div>
      <span
        className="cursor-pointer"
        onClick={() => setRecordingAction(isRecording ? null : shortcutAction)}
      >
        {!isRecording ? (
          <ShortcutRenderer shortcut={shortcut.key} />
        ) : (
          <span className="font-mono text-sm align-middle rounded-md pl-2 pr-1 py-1 transition-colors bg-gray-200 animate-pulse">
            请按下自定义快捷键...
          </span>
        )}
      </span>
    </div>
  ) : null
}

export function ResetDefaultShortcuts() {
  const { shortcuts, resetShortcuts } = useShortcutsStore()
  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-auto"
      onClick={async () => {
        await window.api.updateShortcuts(
          Object.values(shortcuts)
            .filter(({ key, defaultKey }) => key !== defaultKey)
            .map((shortcut) => ({
              ...shortcut,
              key: shortcut.defaultKey
            }))
        )
        resetShortcuts()
        toast.success('重置默认快捷键成功')
      }}
    >
      重置默认快捷键
    </Button>
  )
}
