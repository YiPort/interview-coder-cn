import { useState } from 'react'
import { Pointer, PointerOff, OctagonX, MessageCircle, Volume2, Mic, Download } from 'lucide-react'
import { useSolutionStore } from '@/lib/store/solution'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useAppStore } from '@/lib/store/app'
import { useVoiceStore } from '@/lib/store/voice'
import { useRecorderStore } from '@/lib/store/recorder'
import { defaultStatusBarShortcutHints, useSettingsStore } from '@/lib/store/settings'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const shortcutHintClass =
  'inline-flex items-center gap-1 whitespace-nowrap rounded border border-blue-100/20 bg-gray-950/65 px-1 py-0.5 text-[10px] leading-none text-blue-50 shadow-sm'
const shortcutKeyClass =
  'rounded border border-blue-100/35 bg-gray-900/90 px-1 py-0.5 font-mono text-[9px] leading-none text-white'

const shortcutHintLabels = {
  appendScreenshot: '追加截图',
  takeScreenshot: '新开对话',
  toggleResponseMode: '切换模式',
  codeIdea: '解题思路',
  alternativeSolution: '换个解法',
  voiceQuery: '语音对话',
  toggleTTS: '朗读',
  startRecording: '开始录制',
  stopRecording: '停止录制'
} as const

function compactShortcutLabel(shortcut: string) {
  const isMac = navigator.platform.toLowerCase().includes('mac')
  return shortcut
    .split('+')
    .map((key) => {
      if (key === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl'
      if (key === 'Command') return '⌘'
      if (key === 'Control') return 'Ctrl'
      if (key === 'Option' || key === 'Alt') return isMac ? '⌥' : 'Alt'
      if (key === 'Shift') return isMac ? '⇧' : 'Shift'
      if (key === 'Enter') return '↵'
      return key
    })
    .join('+')
}

function ShortcutHint({ shortcut, label }: { shortcut: string; label: string }) {
  return (
    <span className={shortcutHintClass}>
      <span className={shortcutKeyClass}>{compactShortcutLabel(shortcut)}</span>
      <span>{label}</span>
    </span>
  )
}

export function AppStatusBar() {
  const {
    isLoading: isReceivingSolution,
    setIsLoading,
    screenshotData,
    solutionChunks
  } = useSolutionStore()
  const { ignoreMouse } = useAppStore()
  const { shortcuts } = useShortcutsStore()
  const { responseMode, customPrompt, ttsEnabled, statusBarShortcutHints } = useSettingsStore()
  const { isVoiceMode, isSpeaking } = useVoiceStore()
  const { isRecording, systemSentenceCount, micSentenceCount } = useRecorderStore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [questionInput, setQuestionInput] = useState('')

  const handleStop = () => {
    setIsLoading(false)
    void window.api.stopSolutionStream()
  }

  const handleFollowUpClick = () => {
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setQuestionInput('')
  }

  const handleSubmitQuestion = async () => {
    if (!questionInput.trim()) return

    setIsLoading(true)
    setIsDialogOpen(false)
    const question = questionInput.trim()
    setQuestionInput('')

    try {
      await window.api.sendFollowUpQuestion(question)
    } catch (error) {
      console.error('Error sending follow-up question:', error)
      setIsLoading(false)
    }
  }

  const handleExport = () => {
    const text = solutionChunks.join('')
    if (!text.trim()) return
    const now = new Date()
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `interview-coder-${ts}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Check if there's an active conversation
  const hasActiveConversation = screenshotData && solutionChunks.length > 0
  const hasContent = solutionChunks.length > 0
  const responseModeLabel = getResponseModeLabel(responseMode)
  const responseModeTip =
    responseMode === 'acm'
      ? customPrompt.trim()
        ? '再次切换可进入自定义提示词模式'
        : '未填写自定义提示词，快捷键会跳过自定义模式'
      : '切换核心代码 / ACM / 自定义提示词模式'
  const configuredStatusBarShortcutHints = Array.isArray(statusBarShortcutHints)
    ? statusBarShortcutHints
    : defaultStatusBarShortcutHints
  const visibleShortcutHints = configuredStatusBarShortcutHints.filter((action) => shortcuts[action])

  return (
    <div className="flex w-full shrink-0 items-center justify-between gap-1.5 text-blue-50 bg-gray-900/55 px-2 py-0.5 shadow-[0_-4px_12px_rgba(0,0,0,0.18)] backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        {isReceivingSolution ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-r-2 border-[currentColor]"></div>
            <span className="text-sm">正在生成...</span>
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex justify-center z-50 pointer-events-none">
              <Button
                variant="secondary"
                className="h-8 px-4 text-base shadow-lg pointer-events-auto"
                onClick={handleStop}
              >
                <OctagonX className="w-4 h-4" />
                停止生成
                <ShortcutRenderer
                  shortcut={shortcuts.stopSolutionStream.key}
                  className="inline-block border bg-transparent py-0 px-1"
                />
              </Button>
            </div>
          </div>
        ) : isVoiceMode ? (
          <div className="flex items-center space-x-2">
            <Mic className="w-4 h-4 text-green-400 animate-pulse" />
            <span className="text-sm">正在聆听...</span>
          </div>
        ) : hasActiveConversation ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-md text-blue-50">
            {visibleShortcutHints.map((action) => (
              <ShortcutHint
                key={action}
                shortcut={shortcuts[action].key}
                label={
                  action === 'toggleTTS'
                    ? `朗读${ttsEnabled ? '开' : '关'}`
                    : shortcutHintLabels[action]
                }
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 select-none text-[11px]">
        <div
          className="flex items-center rounded border border-blue-100/25 bg-gray-950/60 px-1.5 py-0.5 leading-none"
          title={responseModeTip}
        >
          <span className="opacity-65">模式:</span>
          <span className="ml-0.5 text-blue-50">{responseModeLabel}</span>
        </div>
        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center rounded border border-red-300/35 bg-red-950/40 px-1.5 py-0.5 leading-none text-red-50">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            <span>
              录制中 面试官:{systemSentenceCount} 我:{micSentenceCount}
            </span>
          </div>
        )}
        {/* TTS Status Indicator */}
        <div className="flex items-center rounded border border-blue-100/25 bg-gray-950/60 px-1.5 py-0.5 leading-none">
          <Volume2 className={`h-3 w-3 ${isSpeaking ? 'text-green-400 animate-pulse' : 'text-blue-100/70'}`} />
          <span className="ml-1">
            朗读:{isSpeaking ? '中' : ttsEnabled ? '开' : '关'}
          </span>
        </div>
        {/* Export Conversation Button */}
        {hasContent && !isReceivingSolution && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-7 px-3 text-xs"
            title="导出对话记录为 Markdown"
          >
            <Download className="w-4 h-4 mr-1" />
            导出对话
          </Button>
        )}
        {/* Follow-up Question Button */}
        {hasActiveConversation && !isReceivingSolution && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFollowUpClick}
            className="h-7 px-3 text-xs"
            disabled={isReceivingSolution}
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            追问问题
          </Button>
        )}
        {/* Mouse Status Indicator */}
        <div className="flex items-center">
          {ignoreMouse ? (
            <>
              <PointerOff className="w-4 h-4 mr-2" />
              <span className="text-xs">
                取消鼠标透传
                <ShortcutRenderer
                  shortcut={shortcuts.ignoreOrEnableMouse.key}
                  className="inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1"
                />
              </span>
            </>
          ) : (
            <Pointer className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Follow-up Question Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTitle className="sr-only">追问问题</DialogTitle>
        <DialogContent>
          <div className="py-4">
            <Textarea
              placeholder="请输入追问内容，按 Ctrl+Enter 提交..."
              value={questionInput}
              className="min-h-24"
              onChange={(e) => setQuestionInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmitQuestion()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogClose}>
              取消
            </Button>
            <Button onClick={handleSubmitQuestion} disabled={!questionInput.trim()}>
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getResponseModeLabel(mode: 'core-code' | 'acm' | 'custom') {
  const labels = {
    'core-code': '核心代码',
    acm: 'ACM',
    custom: '自定义'
  }
  return labels[mode]
}
