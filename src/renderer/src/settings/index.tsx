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
  Radio
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/lib/store/settings'
import { useShortcutsStore } from '@/lib/store/shortcuts'
import { useRecorderStore } from '@/lib/store/recorder'
import { startDualCapture, stopDualCapture } from '@/lib/recorder-capture'
import ShortcutRenderer from '@/components/ShortcutRenderer'
import { SelectModel } from './SelectModel'
import { SelectLanguage } from './SelectLanguage'
import { CustomShortcuts, ResetDefaultShortcuts } from './CustomShortcuts'

export default function SettingsPage() {
  const {
    opacity,
    codeLanguage,
    apiBaseURL,
    apiKey,
    model,
    customPrompt,
    screenshotAutoSave,
    screenshotDir,
    dashscopeApiKey,
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
    updateSetting
  } = useSettingsStore()
  const { shortcuts } = useShortcutsStore()
  const { isRecording, systemSentenceCount, micSentenceCount } = useRecorderStore()
  const startRecKey = shortcuts.startRecording?.key || 'Ctrl+1'
  const stopRecKey = shortcuts.stopRecording?.key || 'Ctrl+2'
  const [showApiKey, setShowApiKey] = useState(false)
  const [showDashscopeApiKey, setShowDashscopeApiKey] = useState(false)
  const [showVisionApiKey, setShowVisionApiKey] = useState(false)
  const [enableCustomPrompt, setEnableCustomPrompt] = useState(customPrompt.trim().length > 0)
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

  const handleCustomPromptToggle = (checked: boolean) => {
    setEnableCustomPrompt(checked)
    if (!checked) {
      // Clear the custom prompt when switch is turned off
      updateSetting('customPrompt', '')
    }
  }

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
                    需先在 Windows 中启用"立体声混音"设备（详见 README），然后在下拉列表中选择该设备
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
          </div>
        </div>

        <div className="bg-gray-300/80 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <SquareTerminal className="h-5 w-5 mr-2" />
            解题设置
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                自定义提示词
                <span className="ml-2 text-xs font-light">
                  通过配置自定义提示词，可将应用能力快速扩展到编程以外的其他场景，用户也可以通过微调提示词来优化效果
                </span>
              </label>
              <Switch
                className="scale-y-90"
                checked={enableCustomPrompt}
                onCheckedChange={handleCustomPromptToggle}
              />
            </div>
            {enableCustomPrompt ? (
              <div className="-mt-2">
                <Textarea
                  value={customPrompt}
                  onChange={(e) => updateSetting('customPrompt', e.target.value)}
                  placeholder="请输入自定义的提示词内容, 示例: 你是一个编程助手, 请根据「截图」和「语音转录内容」给出相关回答。"
                  className="w-full min-h-24 bg-white"
                  rows={4}
                />
              </div>
            ) : (
              <div
                className={`flex items-center justify-between ${enableCustomPrompt ? ' opacity-40 pointer-events-none' : ''}`}
              >
                <label className="text-sm font-medium">
                  编程语言
                  <span className="ml-2 text-xs font-light">启用自定义提示词后，该选项失效</span>
                </label>
                <SelectLanguage
                  value={codeLanguage}
                  onChange={(value) => updateSetting('codeLanguage', value)}
                />
              </div>
            )}
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
