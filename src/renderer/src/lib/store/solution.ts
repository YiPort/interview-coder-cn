import { create } from 'zustand'

interface SolutionState {
  isLoading: boolean
  solutionChunks: string[]
  screenshotData: string | null
  errorMessage: string | null
}

interface SolutionStore extends SolutionState {
  setIsLoading: (isReceiving: boolean) => void
  addSolutionChunk: (chunk: string) => void
  setSolutionChunks: (chunks: string[]) => void
  trimSolutionEnd: () => void
  setScreenshotData: (data: string | null) => void
  setErrorMessage: (message: string | null) => void
  clearSolution: () => void
  resetState: () => void
}

const defaultState: SolutionState = {
  isLoading: false,
  solutionChunks: [],
  screenshotData: null,
  errorMessage: null
}

function cleanCodeBlock(code: string): string {
  return code
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t\n]+$/g, '')
}

function cleanMarkdownCodeBlocks(markdown: string): string {
  return markdown
    .replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_match, language: string, code: string) => {
      return `\`\`\`${language}\n${cleanCodeBlock(code)}\n\`\`\``
    })
    .replace(/[ \t]+$/gm, '')
    .replace(/[ \t\r\n]+$/g, '')
}

export const useSolutionStore = create<SolutionStore>()((set) => ({
  ...defaultState,
  setIsLoading: (isReceiving) => {
    set({ isLoading: isReceiving })
  },
  addSolutionChunk: (chunk) => {
    set((state) => ({
      solutionChunks: [...state.solutionChunks, chunk]
    }))
  },
  setSolutionChunks: (chunks) => {
    set({ solutionChunks: chunks })
  },
  trimSolutionEnd: () => {
    set((state) => {
      const text = cleanMarkdownCodeBlocks(state.solutionChunks.join(''))
      return { solutionChunks: text ? [text] : [] }
    })
  },
  setScreenshotData: (data) => {
    set({ screenshotData: data })
  },
  setErrorMessage: (message) => {
    set({ errorMessage: message })
  },
  clearSolution: () => {
    set({ solutionChunks: [], isLoading: false, errorMessage: null })
  },
  resetState: () => {
    set(defaultState)
  }
}))
