import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  SquareTerminal,
  Palette,
  Shield,
  Bot,
  Eye,
  EyeOff,
  Keyboard,
  FolderOpen,
  Mic,
  Volume2,
  Radio,
  FileText,
  Search,
  Upload,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AI_ANSWER_FONT_SIZE_DEFAULT,
  AI_ANSWER_FONT_SIZE_MAX,
  AI_ANSWER_FONT_SIZE_MIN,
  defaultStatusBarShortcutHints,
  useSettingsStore,
  type StatusBarShortcutHintAction
} from '@/lib/store/settings'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useRecorderStore } from '@/lib/store/recorder'
import { useResumeStore } from '@/lib/store/resume'
import { startDualCapture, stopDualCapture } from '@/lib/recorder-capture'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { SelectModel } from './SelectModel'
import { SelectLanguage } from './SelectLanguage'
import { CustomShortcuts, ResetDefaultShortcuts } from './CustomShortcuts'

const statusBarShortcutHintOptions: Array<{
  action: StatusBarShortcutHintAction
  label: string
  description: string
}> = [
  { action: 'hideOrShowMainWindow', label: '隐藏/显示窗口', description: '显示或隐藏主窗口' },
  { action: 'ignoreOrEnableMouse', label: '鼠标穿透', description: '开启或关闭窗口鼠标穿透' },
  { action: 'appendScreenshot', label: '追加截图', description: '在当前对话中追加题目截图' },
  { action: 'takeScreenshot', label: '新开对话', description: '截图并重新开始一轮解题' },
  { action: 'stopSolutionStream', label: '停止生成', description: '打断当前正在生成的内容' },
  { action: 'toggleResponseMode', label: '切换模式', description: '核心代码 / ACM / 自定义模式' },
  { action: 'codeIdea', label: '解题思路', description: '输出适合口述的代码思路' },
  { action: 'alternativeSolution', label: '换个解法', description: '请求另一种解法' },
  { action: 'toggleTranscription', label: '语音转录', description: '开始或暂停实时语音转录' },
  { action: 'clearTranscription', label: '清除转录', description: '清除已转录但未提交的文本' },
  { action: 'pageUp', label: '向上翻页', description: '主内容区域向上翻页' },
  { action: 'pageDown', label: '向下翻页', description: '主内容区域向下翻页' },
  { action: 'contentScrollUp', label: '内容上滚', description: '滚动当前代码块或内容框' },
  { action: 'contentScrollDown', label: '内容下滚', description: '滚动当前代码块或内容框' },
  { action: 'resetAnswerFontSize', label: '字号默认', description: '恢复 AI 回答默认字号' },
  { action: 'decreaseAnswerFontSize', label: '字号缩小', description: '缩小 AI 回答字号' },
  { action: 'increaseAnswerFontSize', label: '字号放大', description: '放大 AI 回答字号' },
  { action: 'moveMainWindowUp', label: '上移窗口', description: '向上移动主窗口' },
  { action: 'moveMainWindowDown', label: '下移窗口', description: '向下移动主窗口' },
  { action: 'moveMainWindowLeft', label: '左移窗口', description: '向左移动主窗口' },
  { action: 'moveMainWindowRight', label: '右移窗口', description: '向右移动主窗口' },
  { action: 'voiceQuery', label: '语音对话', description: '无需截图直接语音问 AI' },
  { action: 'toggleTTS', label: '朗读开关', description: '开启或关闭答案朗读' },
  { action: 'startRecording', label: '开始录制', description: '显示开始录音快捷键提示' },
  { action: 'stopRecording', label: '停止录制', description: '显示停止录音快捷键提示' }
]

export default function SettingsPage() {
  const {
    opacity,
    codeLanguage,
    apiBaseURL,
    apiKey,
    model,
    customPrompt,
    codeIdeaPrompt,
    screenshotAutoSave,
    screenshotDir,
    dashscopeApiKey,
    transcriptionModel,
    ttsProvider,
    ttsEnabled,
    audioSource,
    systemAudioDeviceId,
    micDeviceId,
    recordDir,
    recordEnabled,
    recordSaveScreenshots,
    useSeparateVisionModel,
    visionApiBaseURL,
    visionApiKey,
    visionModel,
    responseMode,
    voiceWordLimit,
    aiAnswerFontSize,
    statusBarShortcutHints,
    updateSetting
  } = useSettingsStore()
  const { shortcuts } = useShortcutsStore()
  const { isRecording, systemSentenceCount, micSentenceCount } = useRecorderStore()
  const {
    enabled: resumeEnabled,
    jd,
    companyName,
    companyInfo,
    priority,
    rawText,
    structured,
    isParsing,
    isExtracting,
    isSearching,
    selectedFileName,
    errorMessage: resumeError,
    setEnabled: setResumeEnabled,
    setJd,
    setCompanyName,
    setPriority,
    setRawText,
    setStructured,
    setCompanyInfo,
    setIsParsing,
    setIsExtracting,
    setIsSearching,
    setSelectedFileName,
    setErrorMessage,
    clearResume
  } = useResumeStore()
  const startRecKey = shortcuts.startRecording?.key || 'Ctrl+1'
  const stopRecKey = shortcuts.stopRecording?.key || 'Ctrl+2'
  const selectedStatusBarShortcutHints = Array.isArray(statusBarShortcutHints)
    ? statusBarShortcutHints
    : defaultStatusBarShortcutHints
  const [showApiKey, setShowApiKey] = useState(false)
  const [showDashscopeApiKey, setShowDashscopeApiKey] = useState(false)
  const [showVisionApiKey, setShowVisionApiKey] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])

  // API test state
  const [apiTestResult, setApiTestResult] = useState<{
    running: boolean
    success?: boolean
    latencyMs?: number
    error?: string
  } | null>(null)
  const [visionTestResult, setVisionTestResult] = useState<{
    running: boolean
    success?: boolean
    latencyMs?: number
    similarity?: number
    extractedText?: string
    error?: string
  } | null>(null)
  const [customImagePath, setCustomImagePath] = useState<string | null>(null)
  const [customExpectedText, setCustomExpectedText] = useState('')

  const handleTestApiConnection = async () => {
    setApiTestResult({ running: true })
    const result = await window.api.testApiConnection()
    setApiTestResult({ running: false, ...result })
  }

  const handleTestVisionCapability = async () => {
    setVisionTestResult({ running: true })
    const opts =
      customImagePath || customExpectedText.trim()
        ? { imagePath: customImagePath || undefined, expectedText: customExpectedText.trim() || undefined }
        : undefined
    const result = await window.api.testVisionCapability(opts)
    setVisionTestResult({ running: false, ...result })
  }

  const handleSelectCustomImage = async () => {
    const filePath = await window.api.selectImageFile()
    if (filePath) setCustomImagePath(filePath)
  }

  const handleStatusBarShortcutHintChange = (
    action: StatusBarShortcutHintAction,
    checked: boolean
  ) => {
    const next = checked
      ? [...selectedStatusBarShortcutHints, action]
      : selectedStatusBarShortcutHints.filter((item) => item !== action)
    const ordered = statusBarShortcutHintOptions
      .map((option) => option.action)
      .filter((item) => next.includes(item))
    updateSetting('statusBarShortcutHints', ordered)
  }

  useEffect(() => {
    return () => {
      document.body.style.opacity = ''
    }
  }, [])

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices
        .filter((d) => d.kind === 'audioinput' && d.deviceId)
        .map((d) => ({ deviceId: d.deviceId, groupId: d.groupId, kind: d.kind, label: d.label })) as MediaDeviceInfo[]
      setAudioDevices(inputs)
      if (inputs.length > 0 && !micDeviceId) {
        updateSetting('micDeviceId', inputs[0].deviceId)
      }
    } catch {
      // Device enumeration may fail without permission
    }
  }, [micDeviceId, updateSetting])

  useEffect(() => {
    enumerateDevices()
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices)
    }
  }, [enumerateDevices])

  // Recording event listeners for real-time feedback from the test button
  useEffect(() => {
    window.api.onRecordingSentence((channel) => {
      if (channel === 'system') {
        useRecorderStore.getState().incrementSystemCount()
      } else {
        useRecorderStore.getState().incrementMicCount()
      }
    })
    window.api.onRecordingStopped(() => {
      useRecorderStore.getState().reset()
    })
    return () => {
      window.api.removeRecordingSentenceListener()
      window.api.removeRecordingStoppedListener()
    }
  }, [])

  return (
    <>
      {/* Header */}
      <div id="app-header" className="flex items-center">
        <div className="actions">
          <Button variant="ghost" asChild size="icon" className="w-12 mr-2 rounded-none">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </div>
        <h1>设置</h1>
      </div>

      {/* Settings Content */}
      <div id="app-content" className="flex flex-col gap-4 p-8">
        {/* AI Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Bot className="h-5 w-5 mr-2" />
            AI 设置
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                API Base URL
                <span className="ml-2 text-xs font-light">
                  如硅基流动为 https://api.siliconflow.cn/v1
                </span>
              </label>
              <input
                type="text"
                value={apiBaseURL}
                onChange={(e) => updateSetting('apiBaseURL', e.target.value)}
                className="w-60 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="可为空，默认使用 OpenAI 的 API"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">API Key</label>
              <div className="flex items-center w-60">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => updateSetting('apiKey', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入 API Key"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="border border-l-0 rounded-l-none rounded-r-md h-9 w-9 hover:border-none"
                >
                  {showApiKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Model
                <span className="ml-2 text-xs font-light">
                  这里列了几个流行的国内和国外模型，请自行确认你的平台是否支持
                </span>
              </label>
              <SelectModel value={model} onChange={(val) => updateSetting('model', val)} />
            </div>
          </div>

          {/* Vision Model Settings */}
          <div className="mt-4 pt-4 border-t border-gray-400/30 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                使用独立视觉模型
                <span className="ml-2 text-xs font-light">
                  开启后，图片解析和题目解答分别使用不同模型，适合主模型不支持图片的情况
                </span>
              </label>
              <Switch
                className="scale-y-90"
                checked={useSeparateVisionModel}
                onCheckedChange={(checked) => updateSetting('useSeparateVisionModel', checked)}
              />
            </div>

            {useSeparateVisionModel && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    视觉 API Base URL
                    <span className="ml-2 text-xs font-light">
                      用于解析图片的 API 地址，如 https://api.siliconflow.cn/v1
                    </span>
                  </label>
                  <input
                    type="text"
                    value={visionApiBaseURL}
                    onChange={(e) => updateSetting('visionApiBaseURL', e.target.value)}
                    className="w-60 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="留空则使用主 API 地址"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">视觉 API Key</label>
                  <div className="flex items-center w-60">
                    <input
                      type={showVisionApiKey ? 'text' : 'password'}
                      value={visionApiKey}
                      onChange={(e) => updateSetting('visionApiKey', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="留空则使用主 API Key"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowVisionApiKey(!showVisionApiKey)}
                      className="border border-l-0 rounded-l-none rounded-r-md h-9 w-9 hover:border-none"
                    >
                      {showVisionApiKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    视觉模型
                    <span className="ml-2 text-xs font-light">
                      用于解析图片的模型，需支持视觉输入
                    </span>
                  </label>
                  <input
                    type="text"
                    value={visionModel}
                    onChange={(e) => updateSetting('visionModel', e.target.value)}
                    className="w-60 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如 Qwen/Qwen3-VL-32B-Instruct"
                  />
                </div>
              </>
            )}
          </div>

          {/* API Detection */}
          <div className="mt-4 pt-4 border-t border-gray-400/30 space-y-3">
            <label className="text-sm font-medium">
              API 连接检测
              <span className="ml-2 text-xs font-light">
                检测 API 连通性和模型能力
              </span>
            </label>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestApiConnection}
                disabled={apiTestResult?.running}
              >
                {apiTestResult?.running ? '检测中...' : '检测 API 连接'}
              </Button>
              {apiTestResult && !apiTestResult.running && (
                <span
                  className={`text-xs ${apiTestResult.success ? 'text-green-600' : 'text-red-600'}`}
                >
                  {apiTestResult.success
                    ? `连接成功，延迟 ${apiTestResult.latencyMs}ms`
                    : `连接失败：${apiTestResult.error}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestVisionCapability}
                disabled={visionTestResult?.running}
              >
                {visionTestResult?.running ? '检测中...' : '检测图片解析能力'}
              </Button>
              {visionTestResult && !visionTestResult.running && (
                <div className="text-xs flex-1">
                  {visionTestResult.success ? (
                    <div>
                      <span className="text-green-600">
                        图片解析成功，延迟 {visionTestResult.latencyMs}ms
                      </span>
                      {visionTestResult.similarity != null && (
                        <span
                          className={`ml-2 font-semibold ${
                            visionTestResult.similarity >= 90
                              ? 'text-green-600'
                              : visionTestResult.similarity >= 70
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}
                        >
                          相似度 {visionTestResult.similarity}%
                          {visionTestResult.similarity >= 90
                            ? ' ✅'
                            : visionTestResult.similarity >= 70
                              ? ' ⚠️ 一般'
                              : ' ❌ 偏低'}
                        </span>
                      )}
                      {visionTestResult.extractedText && (
                        <div className="mt-1 p-2 bg-white/70 rounded border border-gray-300 text-gray-700 max-h-32 overflow-y-auto">
                          <span className="font-medium text-gray-500">识别结果：</span>
                          {visionTestResult.extractedText}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-red-600">解析失败：{visionTestResult.error}</span>
                  )}
                </div>
              )}
            </div>

            {/* Custom test */}
            <div className="pt-2 border-t border-gray-400/20 space-y-2">
              <label className="text-xs font-medium text-gray-500">
                自定义检测标准
              </label>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleSelectCustomImage}>
                  {customImagePath ? '更换图片' : '选择自定义图片'}
                </Button>
                {customImagePath ? (
                  <span className="text-xs text-green-700 truncate max-w-48" title={customImagePath}>
                    已选择：{customImagePath.split(/[\\/]/).pop()}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">默认使用内置示例图片（两数相加链表题）</span>
                )}
                {customImagePath && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-500 h-6 px-2"
                    onClick={() => setCustomImagePath(null)}
                  >
                    清除
                  </Button>
                )}
              </div>

              <div>
                <textarea
                  value={customExpectedText}
                  onChange={(e) => setCustomExpectedText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder={
                    '输入图片中预期的题目文字，用于计算相似度。留空则使用默认示例的预期文本。\n\n示例：\n给你两个 非空 的链表，表示两个非负的整数。它们每位数字都是按照 逆序 的方式存储的，并且每个节点只能存储 一位 数字。请你将两个数相加，并以相同形式返回一个表示和的链表。'
                  }
                />
                {!customExpectedText.trim() && !customImagePath && (
                  <p className="text-xs text-gray-400 mt-1">
                    留空使用内置默认预期文本；选择自定义图片后建议填写对应的预期文字。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Resume Analysis */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            简历分析
            <span className="text-sm font-light ml-2 mt-0.5">
              上传简历，AI 提取关键信息，辅助针对性面试回答
            </span>
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                启用简历上下文
                <span className="ml-2 text-xs font-light">
                  开启后，AI 回答时会参考你的简历背景
                </span>
              </label>
              <Switch
                className="scale-y-90"
                checked={resumeEnabled}
                onCheckedChange={(checked) => setResumeEnabled(checked)}
              />
            </div>

            <div className={`space-y-4 ${!resumeEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              {/* Upload — parses and immediately AI-extracts */}
              <div className="flex items-start justify-between">
                <label className="text-sm font-medium pt-1">
                  上传简历
                  <span className="ml-2 text-xs font-light block mt-0.5">
                    支持 PDF、Word、Markdown、TXT 或截图，上传后自动 AI 分析
                  </span>
                </label>
                <div className="w-60 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={isParsing || isExtracting}
                      onClick={async () => {
                        const filePath = await window.api.selectResumeFile()
                        if (!filePath) return
                        const name = filePath.split(/[\\/]/).pop() || filePath
                        setSelectedFileName(name)
                        setIsParsing(true)
                        setErrorMessage(null)
                        try {
                          const text = await window.api.parseResumeFile(filePath)
                          setRawText(text)
                          setIsParsing(false)
                          setIsExtracting(true)
                          try {
                            const data = await window.api.extractResumeStructured()
                            setStructured(data)
                          } catch (err) {
                            setErrorMessage(err instanceof Error ? err.message : 'AI 提取失败')
                          }
                        } catch (err) {
                          setErrorMessage(err instanceof Error ? err.message : '解析失败')
                          setSelectedFileName(null)
                        } finally {
                          setIsParsing(false)
                          setIsExtracting(false)
                        }
                      }}
                    >
                      {(isParsing || isExtracting) ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      {isParsing ? '解析中...' : isExtracting ? 'AI 分析中...' : '选择文件'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isParsing || isExtracting}
                      onClick={async () => {
                        const filePath = await window.api.selectResumeImage()
                        if (!filePath) return
                        const name = filePath.split(/[\\/]/).pop() || filePath
                        setSelectedFileName(name)
                        setIsParsing(true)
                        setErrorMessage(null)
                        try {
                          const text = await window.api.parseResumeImage(filePath)
                          setRawText(text)
                          setIsParsing(false)
                          setIsExtracting(true)
                          try {
                            const data = await window.api.extractResumeStructured()
                            setStructured(data)
                          } catch (err) {
                            setErrorMessage(err instanceof Error ? err.message : 'AI 提取失败')
                          }
                        } catch (err) {
                          setErrorMessage(err instanceof Error ? err.message : '截图解析失败')
                          setSelectedFileName(null)
                        } finally {
                          setIsParsing(false)
                          setIsExtracting(false)
                        }
                      }}
                    >
                      截图
                    </Button>
                  </div>
                  {selectedFileName && (
                    <p className="text-xs text-green-700 truncate">
                      已选择：{selectedFileName}
                      {rawText && `（${rawText.length} 字符）`}
                    </p>
                  )}
                </div>
              </div>

              {/* Editable structured fields — shown after AI extraction */}
              {structured && (
                <div className="pt-2 border-t border-gray-400/20 space-y-3">
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <Search className="h-3 w-3" />
                    AI 提取结果 — 请审核并修改
                  </label>

                  <div className="flex items-start justify-between">
                    <label className="text-xs font-medium pt-1.5">技术栈</label>
                    <input
                      type="text"
                      value={structured.techStack.join('、')}
                      onChange={(e) =>
                        setStructured({
                          ...structured,
                          techStack: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
                        })
                      }
                      className="w-60 px-2 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="如：React、TypeScript、Node.js"
                    />
                  </div>

                  <div className="flex items-start justify-between">
                    <label className="text-xs font-medium pt-1.5">工作经历</label>
                    <textarea
                      value={structured.workExperience}
                      onChange={(e) =>
                        setStructured({ ...structured, workExperience: e.target.value })
                      }
                      className="w-60 px-2 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="无"
                    />
                  </div>

                  <div className="flex items-start justify-between">
                    <label className="text-xs font-medium pt-1.5">实习经历</label>
                    <textarea
                      value={structured.internshipExperience}
                      onChange={(e) =>
                        setStructured({ ...structured, internshipExperience: e.target.value })
                      }
                      className="w-60 px-2 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="无"
                    />
                  </div>

                  <div className="flex items-start justify-between">
                    <label className="text-xs font-medium pt-1.5">项目经历</label>
                    <textarea
                      value={structured.projectExperience}
                      onChange={(e) =>
                        setStructured({ ...structured, projectExperience: e.target.value })
                      }
                      className="w-60 px-2 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="无"
                    />
                  </div>

                  <div className="flex items-start justify-between">
                    <label className="text-xs font-medium pt-1.5">教育背景</label>
                    <textarea
                      value={structured.education}
                      onChange={(e) =>
                        setStructured({ ...structured, education: e.target.value })
                      }
                      className="w-60 px-2 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="无"
                    />
                  </div>

                  {/* Context preview */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                      预览注入的上下文
                    </summary>
                    <div className="mt-2 p-3 bg-white/80 rounded border border-gray-200 max-h-64 overflow-y-auto whitespace-pre-wrap text-gray-700 text-xs leading-relaxed">
                      <p className="text-gray-400 mb-2">以下内容将被注入到 AI 的 system prompt 中：</p>
                      <p className="font-semibold">## 候选人背景信息</p>
                      <p className="text-gray-400">优先级：题目本身 &gt; 候选人自身情况 &gt;= 岗位JD &gt; 公司业务</p>
                      {priority.selfInfo > 0 && (structured.techStack.length > 0 || structured.workExperience || structured.internshipExperience || structured.projectExperience || structured.education) && (
                        <>
                          <p className="mt-1"><strong>### 候选人简历（重要程度：{priority.selfInfo}/100）</strong></p>
                          {structured.techStack.length > 0 && (
                            <p><strong>技术栈</strong>：{structured.techStack.join('、')}</p>
                          )}
                          {structured.workExperience && (
                            <p className="mt-1"><strong>工作经历</strong>：{structured.workExperience}</p>
                          )}
                          {structured.internshipExperience && (
                            <p className="mt-1"><strong>实习经历</strong>：{structured.internshipExperience}</p>
                          )}
                          {structured.projectExperience && (
                            <p className="mt-1"><strong>项目经验</strong>：{structured.projectExperience}</p>
                          )}
                          {structured.education && (
                            <p className="mt-1"><strong>教育背景</strong>：{structured.education}</p>
                          )}
                        </>
                      )}
                      {priority.jd > 0 && jd && (
                        <p className="mt-1"><strong>### 目标岗位 JD（重要程度：{priority.jd}/100）</strong><br />{jd}</p>
                      )}
                      {priority.companyBusiness > 0 && companyInfo && (
                        <p className="mt-1"><strong>### 目标公司调研（重要程度：{priority.companyBusiness}/100）</strong><br />{companyInfo}</p>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* JD Input */}
              <div className="flex items-start justify-between">
                <label className="text-sm font-medium pt-1">
                  目标岗位 JD
                  <span className="ml-2 text-xs font-light block mt-0.5">
                    可选，填写投递岗位的职位描述
                  </span>
                </label>
                <div className="w-60">
                  <Textarea
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    placeholder="如：负责公司核心业务系统的架构设计与开发..."
                    className="w-full min-h-16 bg-white text-xs"
                    rows={3}
                  />
                </div>
              </div>

              {/* Company Search */}
              <div className="flex items-start justify-between">
                <label className="text-sm font-medium pt-1">
                  公司调研
                  <span className="ml-2 text-xs font-light block mt-0.5">
                    输入目标公司名称，AI 搜索公司背景信息
                  </span>
                </label>
                <div className="w-60 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="如：字节跳动"
                    />
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isSearching || !companyName.trim()}
                      onClick={async () => {
                        setIsSearching(true)
                        setErrorMessage(null)
                        try {
                          const info = await window.api.searchCompanyInfo(companyName)
                          setCompanyInfo(info)
                        } catch (err) {
                          setErrorMessage(err instanceof Error ? err.message : '搜索失败')
                        } finally {
                          setIsSearching(false)
                        }
                      }}
                    >
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {companyInfo && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                        查看调研结果（{companyInfo.length} 字符）
                      </summary>
                      <div className="mt-1 p-2 bg-white/80 rounded border border-gray-200 max-h-48 overflow-y-auto whitespace-pre-wrap text-gray-700">
                        {companyInfo}
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Priority Sliders */}
              <div className="pt-2 border-t border-gray-400/20 space-y-3">
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  背景信息权重
                  <span className="text-xs font-light">调整各项背景信息在 AI 回答中的重要程度</span>
                </label>

                <div className="flex items-center justify-between">
                  <span className="text-xs">题目信息</span>
                  <div className="w-60 flex items-center gap-2">
                    <span className="text-xs w-8 text-right font-semibold text-gray-500">固定</span>
                    <span className="text-xs text-gray-400">最高优先级</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs">候选人信息</span>
                  <div className="w-60 flex items-center gap-2">
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[priority.selfInfo]}
                      onValueChange={([v]) => setPriority('selfInfo', v)}
                    />
                    <span className="text-xs w-8 text-right">{priority.selfInfo}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs">岗位 JD</span>
                  <div className="w-60 flex items-center gap-2">
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[priority.jd]}
                      onValueChange={([v]) => setPriority('jd', v)}
                    />
                    <span className="text-xs w-8 text-right">{priority.jd}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs">公司调研</span>
                  <div className="w-60 flex items-center gap-2">
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[priority.companyBusiness]}
                      onValueChange={([v]) => setPriority('companyBusiness', v)}
                    />
                    <span className="text-xs w-8 text-right">{priority.companyBusiness}</span>
                  </div>
                </div>
              </div>

              {/* Error */}
              {resumeError && (
                <div className="text-xs text-red-600 bg-red-50 rounded p-2">{resumeError}</div>
              )}

              {/* Clear */}
              {(rawText || structured) && (
                <div className="pt-2 border-t border-gray-400/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-500 h-7"
                    onClick={clearResume}
                  >
                    清除简历数据
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transcription Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Mic className="h-5 w-5 mr-2" />
            语音转录
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                百炼平台 API Key
                <span className="ml-2 text-xs font-light">
                  从阿里云
                  <a
                    href="https://bailian.console.aliyun.com/cn-beijing?tab=model#/api-key"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-0.5 text-blue-700 hover:underline"
                  >
                    百炼平台
                  </a>
                  获取，如不需要语音转录功能可跳过
                </span>
              </label>
              <div className="flex items-center w-60">
                <input
                  type={showDashscopeApiKey ? 'text' : 'password'}
                  value={dashscopeApiKey}
                  onChange={(e) => updateSetting('dashscopeApiKey', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入百炼平台 API Key"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDashscopeApiKey(!showDashscopeApiKey)}
                  className="border border-l-0 rounded-l-none rounded-r-md h-9 w-9 hover:border-none"
                >
                  {showDashscopeApiKey ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                转录模型
                <span className="ml-2 text-xs font-light">
                  留空则使用系统预设模型 fun-asr-realtime
                </span>
              </label>
              <input
                type="text"
                value={transcriptionModel}
                onChange={(e) => updateSetting('transcriptionModel', e.target.value)}
                className="w-60 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="fun-asr-realtime"
              />
            </div>

            <div className="flex items-start justify-between">
              <label className="text-sm font-medium pt-1">
                音频来源
                <span className="ml-2 text-xs font-light block mt-0.5">
                  系统音频捕获电脑播放的声音（面试官语音、视频声音等），
                  <br />
                  麦克风捕获你说话的声音
                </span>
              </label>
              <div className="w-60 space-y-3">
                {/* System audio — uses Stereo Mix (立体声混音) virtual device via getUserMedia */}
                <div
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    audioSource === 'system'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                  onClick={() => updateSetting('audioSource', 'system')}
                >
                  <label className="flex items-center gap-1 cursor-pointer mb-1">
                    <input
                      type="radio"
                      name="audioSource"
                      value="system"
                      checked={audioSource === 'system'}
                      onChange={() => updateSetting('audioSource', 'system')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">系统音频</span>
                    <span className="text-xs text-gray-400 ml-1">（电脑声音）</span>
                  </label>
                  <p className="text-xs text-gray-400 ml-5 mb-2">
                    需先在 Windows 中启用“立体声混音”设备（详见 README），然后在下拉列表中选择该设备
                  </p>
                  {audioDevices.length > 0 && (
                    <select
                      value={systemAudioDeviceId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        updateSetting('systemAudioDeviceId', e.target.value)
                      }}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `设备 (${device.deviceId.slice(0, 8)}...)`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Microphone — uses getUserMedia, device dropdown for mic selection */}
                <div
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    audioSource === 'microphone'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                  onClick={() => updateSetting('audioSource', 'microphone')}
                >
                  <label className="flex items-center gap-1 cursor-pointer mb-1">
                    <input
                      type="radio"
                      name="audioSource"
                      value="microphone"
                      checked={audioSource === 'microphone'}
                      onChange={() => updateSetting('audioSource', 'microphone')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">麦克风</span>
                    <span className="text-xs text-gray-400 ml-1">（你的声音）</span>
                  </label>
                  {audioDevices.length > 0 && (
                    <select
                      value={micDeviceId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        updateSetting('micDeviceId', e.target.value)
                      }}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `设备 (${device.deviceId.slice(0, 8)}...)`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TTS Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Volume2 className="h-5 w-5 mr-2" />
            语音合成 (TTS)
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                TTS 引擎
                <span className="ml-2 text-xs font-light">
                  浏览器内置免费，百炼平台需消耗 API 额度
                </span>
              </label>
              <div className="w-60 flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="ttsProvider"
                    value="web-speech"
                    checked={ttsProvider === 'web-speech'}
                    onChange={() => updateSetting('ttsProvider', 'web-speech')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">浏览器内置</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer ml-4">
                  <input
                    type="radio"
                    name="ttsProvider"
                    value="dashscope"
                    checked={ttsProvider === 'dashscope'}
                    onChange={() => updateSetting('ttsProvider', 'dashscope')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">百炼平台</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                自动朗读答案
                <span className="ml-2 text-xs font-light">
                  AI 回答完成后自动使用语音朗读
                </span>
              </label>
              <Switch
                className="scale-y-90"
                checked={ttsEnabled}
                onCheckedChange={(checked) => updateSetting('ttsEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                语音回答字数上限
                <span className="ml-2 text-xs font-light">
                  数值越小回答越快，推荐 200-500 字
                </span>
              </label>
              <div className="w-60 flex items-center gap-2">
                <Slider
                  min={100}
                  max={1000}
                  step={50}
                  value={[voiceWordLimit]}
                  onValueChange={([v]) => updateSetting('voiceWordLimit', v)}
                />
                <span className="text-xs w-10 text-right">{voiceWordLimit}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <SquareTerminal className="h-5 w-5 mr-2" />
            解题设置
          </h2>

          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <label className="text-sm font-medium pt-1">
                回答模式
                <span className="ml-2 text-xs font-light block mt-0.5">
                  核心代码模式仅输出解题代码，紧凑在一页以内；
                  <br />
                  ACM模式输出可直接运行的完整代码；自定义模式可自由编写提示词
                </span>
              </label>
              <div className="w-60 space-y-2">
                <div
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    responseMode === 'core-code'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                  onClick={() => updateSetting('responseMode', 'core-code')}
                >
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="responseMode"
                      value="core-code"
                      checked={responseMode === 'core-code'}
                      onChange={() => updateSetting('responseMode', 'core-code')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">核心代码模式</span>
                  </label>
                  <p className="text-xs text-gray-400 ml-5 mt-1">
                    仅输出核心解题代码，紧凑在一页以内，无任何解释说明
                  </p>
                </div>
                <div
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    responseMode === 'acm'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                  onClick={() => updateSetting('responseMode', 'acm')}
                >
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="responseMode"
                      value="acm"
                      checked={responseMode === 'acm'}
                      onChange={() => updateSetting('responseMode', 'acm')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">ACM 模式</span>
                  </label>
                  <p className="text-xs text-gray-400 ml-5 mt-1">
                    包含完整输入输出代码，可直接复制到在线评测系统运行
                  </p>
                </div>
                <div
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    responseMode === 'custom'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                  onClick={() => updateSetting('responseMode', 'custom')}
                >
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="responseMode"
                      value="custom"
                      checked={responseMode === 'custom'}
                      onChange={() => updateSetting('responseMode', 'custom')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">自定义提示词</span>
                  </label>
                  <p className="text-xs text-gray-400 ml-5 mt-1">
                    自由编写提示词，适用于非编程类场景或微调回答风格；未填写时快捷键会跳过该模式
                  </p>
                </div>
              </div>
            </div>

            {responseMode === 'custom' ? (
              <div>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => updateSetting('customPrompt', e.target.value)}
                  placeholder="请输入自定义的提示词内容, 示例: 你是一个编程助手, 请根据「截图」和「语音转录内容」给出相关回答。"
                  className="w-full min-h-24 bg-white"
                  rows={4}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  编程语言
                  <span className="ml-2 text-xs font-light">选择代码输出的编程语言</span>
                </label>
                <SelectLanguage
                  value={codeLanguage}
                  onChange={(value) => updateSetting('codeLanguage', value)}
                />
              </div>
            )}

            <div className="pt-4 border-t border-gray-400/30 space-y-2">
              <label className="text-sm font-medium">
                解题思路提示词
                <span className="ml-2 text-xs font-light">
                  按下“解题思路”快捷键时使用；留空则使用默认提示词
                </span>
              </label>
              <Textarea
                value={codeIdeaPrompt}
                onChange={(e) => updateSetting('codeIdeaPrompt', e.target.value)}
                placeholder={
                  '默认要求：像面试口述一样说明为什么用这个方法、代码实现步骤、关键变量、边界情况和复杂度；不输出完整代码，并尽量一屏读完。'
                }
                className="w-full min-h-24 bg-white"
                rows={4}
              />
              <p className="text-xs text-gray-500">
                建议写清楚你想看的结构，例如：“先讲方法和原因，再按代码执行顺序讲步骤，最后说边界和复杂度”。
              </p>
            </div>
          </div>
        </div>

        {/* Shortcuts Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Keyboard className="h-5 w-5 mr-2" />
            快捷键设置
            <div className="text-sm font-light ml-2 mt-1">
              只有在主界面时，快捷键才有效。当前页面仅部分快捷键生效。
            </div>
            <ResetDefaultShortcuts />
          </h2>
          <CustomShortcuts />
        </div>

        {/* Screenshot Save Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <FolderOpen className="h-5 w-5 mr-2" />
            保存截图
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                保存截图到本地
                <span className="ml-2 text-xs font-light">
                  开启后，每次截图都会自动保存到指定目录
                </span>
              </label>
              <Switch
                className="scale-y-90"
                checked={screenshotAutoSave}
                onCheckedChange={(checked) => updateSetting('screenshotAutoSave', checked)}
              />
            </div>
            {screenshotAutoSave && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  保存目录
                  <span className="ml-2 text-xs font-light">
                    可点击右侧内容重新选择保存目录（选择弹窗可能被本窗口遮挡）
                  </span>
                </label>
                <button
                  className="text-xs text-gray-600 max-w-48 truncate hover:text-gray-900 cursor-pointer transition-colors"
                  title="点击选择保存目录"
                  onClick={async () => {
                    const dir = await window.api.selectScreenshotDir()
                    if (dir) updateSetting('screenshotDir', dir)
                  }}
                >
                  {screenshotDir || '默认: 图片/InterviewCoder'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recording Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Radio className="h-5 w-5 mr-2" />
            录音设置
            <span className="text-sm font-light ml-2 mt-0.5">
              同时记录面试官和你的语音，方便面试复盘
            </span>
            {isRecording && (
              <span className="flex items-center ml-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1" />
                <span className="text-xs text-red-600">
                  录音中 面试官:{systemSentenceCount} 我:{micSentenceCount}
                </span>
              </span>
            )}
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                启用面试录音
                <span className="ml-2 text-xs font-light">
                  开启后可在主界面按
                  <ShortcutRenderer
                    shortcut={startRecKey}
                    className="inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1 mx-0.5 align-middle"
                  />
                  开始录音，按
                  <ShortcutRenderer
                    shortcut={stopRecKey}
                    className="inline-block scale-75 text-xs border border-current bg-transparent py-0 px-1 mx-0.5 align-middle"
                  />
                  停止录音
                </span>
              </label>
              <Switch
                className="scale-y-90"
                checked={recordEnabled}
                onCheckedChange={(checked) => updateSetting('recordEnabled', checked)}
              />
            </div>

            <div
              className={`space-y-4 ${!recordEnabled ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  在录音中保存截图
                  <span className="ml-2 text-xs font-light">
                    截图时将图片嵌入录音文档
                  </span>
                </label>
                <Switch
                  className="scale-y-90"
                  checked={recordSaveScreenshots}
                  onCheckedChange={(checked) => updateSetting('recordSaveScreenshots', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  录音保存目录
                  <span className="ml-2 text-xs font-light">
                    录音文档和截图将保存在此目录下
                  </span>
                </label>
                <button
                  className="text-xs text-gray-600 max-w-48 truncate hover:text-gray-900 cursor-pointer transition-colors"
                  title="点击选择录音保存目录"
                  onClick={async () => {
                    const dir = await window.api.selectRecordDir()
                    if (dir) updateSetting('recordDir', dir)
                  }}
                >
                  {recordDir || '默认: 文档/InterviewCoder/Records'}
                </button>
              </div>

              {/* Recording test button */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-400/30">
                <label className="text-sm font-medium">
                  功能检测
                  <span className="ml-2 text-xs font-light">
                    点击按钮测试录音功能是否正常，查看实时转录效果
                  </span>
                </label>
                <Button
                  variant={isRecording ? 'destructive' : 'default'}
                  size="sm"
                  className="h-8 px-4"
                  onClick={async () => {
                    if (isRecording) {
                      stopDualCapture()
                      await window.api.stopRecording()
                      useRecorderStore.getState().reset()
                    } else {
                      if (!dashscopeApiKey) return
                      try {
                        await startDualCapture(
                          systemAudioDeviceId || undefined,
                          micDeviceId || undefined
                        )
                        await window.api.startRecording(
                          dashscopeApiKey,
                          systemAudioDeviceId,
                          micDeviceId
                        )
                        useRecorderStore.getState().setIsRecording(true)
                      } catch (err) {
                        console.error('Failed to start recording test:', err)
                        stopDualCapture()
                      }
                    }
                  }}
                  disabled={!dashscopeApiKey || !recordEnabled}
                >
                  {isRecording ? '停止录音' : '测试录音'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Palette className="h-5 w-5 mr-2" />
            外观设置
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                窗口透明度
                <span className="ml-2 text-xs font-light">拖动可实时预览效果</span>
              </label>
              <div className="w-60 flex items-center gap-2">
                <span className="text-xs whitespace-nowrap">透明</span>
                <Slider
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={[opacity]}
                  onValueChange={(value) => {
                    updateSetting('opacity', value[0])
                    document.body.style.opacity = value[0].toString()
                  }}
                />
                <span className="text-xs whitespace-nowrap">不透明</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-400/30">
              <label className="text-sm font-medium">
                AI 回答字号
                <span className="ml-2 text-xs font-light">
                  调整主界面 AI 答案文字大小，默认 {AI_ANSWER_FONT_SIZE_DEFAULT}px
                </span>
              </label>
              <div className="w-60 flex items-center gap-2">
                <span className="text-xs whitespace-nowrap">{AI_ANSWER_FONT_SIZE_MIN}px</span>
                <Slider
                  min={AI_ANSWER_FONT_SIZE_MIN}
                  max={AI_ANSWER_FONT_SIZE_MAX}
                  step={1}
                  value={[aiAnswerFontSize]}
                  onValueChange={(value) => updateSetting('aiAnswerFontSize', value[0])}
                />
                <span className="text-xs whitespace-nowrap">{AI_ANSWER_FONT_SIZE_MAX}px</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => updateSetting('aiAnswerFontSize', AI_ANSWER_FONT_SIZE_DEFAULT)}
                >
                  默认
                </Button>
              </div>
              <span className="ml-3 w-10 text-right text-xs text-gray-600">
                {aiAnswerFontSize}px
              </span>
            </div>

            <div className="flex items-start justify-between pt-4 border-t border-gray-400/30">
              <label className="text-sm font-medium pt-1">
                底部快捷键提示
                <span className="ml-2 text-xs font-light block mt-0.5">
                  选择主界面底部要展示的快捷键，减少提示占用空间
                </span>
              </label>
              <div className="w-80 grid grid-cols-2 gap-2">
                {statusBarShortcutHintOptions.map((option) => {
                  const checked = selectedStatusBarShortcutHints.includes(option.action)
                  const shortcut = shortcuts[option.action]

                  return (
                    <label
                      key={option.action}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-300 bg-white/80 p-2 text-xs hover:border-gray-400"
                      title={option.description}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          handleStatusBarShortcutHintChange(option.action, value === true)
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-gray-800">{option.label}</span>
                        {shortcut && (
                          <ShortcutRenderer
                            shortcut={shortcut.key}
                            className="mt-1 inline-flex scale-90 border border-gray-400 bg-gray-100 py-0 px-1 text-[10px]"
                          />
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            隐私设置
          </h2>

          <div className="space-y-4">
            <p className="text-sm">
              此应用为本地应用，采集的图片直接上传到您配置的 OpenAI
              等大模型公司，不存在隐私泄露风险。
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
