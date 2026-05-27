import { useState } from 'react'
import { Pointer, PointerOff, OctagonX, MessageCircle, Volume2, Mic, Download } from 'lucide-react'
import { useSolutionStore } from '@/lib/store/solution'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useAppStore } from '@/lib/store/app'
import { useVoiceStore } from '@/lib/store/voice'
import { useRecorderStore } from '@/lib/store/recorder'
import { useSettingsStore } from '@/lib/store/settings'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export function AppStatusBar() {
  const {
    isLoading: isReceivingSolution,
    setIsLoading,
    screenshotData,
    solutionChunks
  } = useSolutionStore()
  const { ignoreMouse } = useAppStore()
  const { shortcuts } = useShortcutsStore()
  const { responseMode, customPrompt } = useSettingsStore()
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

  return (
    <div className="absolute bottom-0 flex items-center justify-between w-full text-blue-100 bg-gray-600/10 px-4 pb-1">
      <div>
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
          <div className="flex items-center space-x-2 pointer-events-none opacity-50 text-sm gap-1">
            <span>
              <ShortcutRenderer
                shortcut={shortcuts.appendScreenshot.key}
                className="inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1 ml-1"
              />
              追加截图
            </span>
            <span>
              <ShortcutRenderer
                shortcut={shortcuts.takeScreenshot.key}
                className="inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1"
              />
              新开对话
            </span>
            <span>
              <ShortcutRenderer
                shortcut={shortcuts.toggleResponseMode.key}
                className="inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1"
              />
              切换模式
            </span>
            <span>
              <ShortcutRenderer
                shortcut={shortcuts.codeIdea.key}
                className="inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1"
              />
              解题思路
            </span>
            <span>
              <ShortcutRenderer
                shortcut={shortcuts.alternativeSolution.key}
                className="inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1"
              />
              换个解法
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center space-x-4 select-none">
        <div className="flex items-center text-xs" title={responseModeTip}>
          <span className="mr-1 opacity-70">模式</span>
          <span className="rounded border border-blue-100/40 bg-gray-700/50 px-1.5 py-0.5">
            {responseModeLabel}
          </span>
          <ShortcutRenderer
            shortcut={shortcuts.toggleResponseMode.key}
            className="ml-1 inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1"
          />
        </div>
        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1.5" />
            <span className="text-xs">
              录音中 面试官:{systemSentenceCount} 我:{micSentenceCount}
            </span>
          </div>
        )}
        {/* TTS Status Indicator */}
        {isSpeaking && (
          <div className="flex items-center">
            <Volume2 className="w-4 h-4 text-green-400 animate-pulse" />
            <span className="text-xs ml-1">朗读中...</span>
          </div>
        )}
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
