import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ResumeStructured {
  techStack: string[]
  projectExperience: string
  internshipExperience: string
  workExperience: string
  education: string
}

interface ResumePriority {
  selfInfo: number
  jd: number
  companyBusiness: number
}

interface ResumeState {
  rawText: string
  structured: ResumeStructured | null
  jd: string
  companyName: string
  companyInfo: string
  priority: ResumePriority
  enabled: boolean
  // UI state (not persisted)
  isParsing: boolean
  isExtracting: boolean
  isSearching: boolean
  selectedFileName: string | null
  errorMessage: string | null
}

interface ResumeStore extends ResumeState {
  setEnabled: (enabled: boolean) => void
  setJd: (jd: string) => void
  setCompanyName: (name: string) => void
  setPriority: (key: keyof ResumePriority, value: number) => void
  setRawText: (text: string) => void
  setStructured: (data: ResumeStructured | null) => void
  setCompanyInfo: (info: string) => void
  setIsParsing: (v: boolean) => void
  setIsExtracting: (v: boolean) => void
  setIsSearching: (v: boolean) => void
  setSelectedFileName: (name: string | null) => void
  setErrorMessage: (msg: string | null) => void
  clearResume: () => void
  syncToMain: () => void
}

const defaultState: Omit<
  ResumeState,
  'isParsing' | 'isExtracting' | 'isSearching' | 'selectedFileName' | 'errorMessage'
> = {
  rawText: '',
  structured: null,
  jd: '',
  companyName: '',
  companyInfo: '',
  priority: { selfInfo: 80, jd: 70, companyBusiness: 50 },
  enabled: false
}

export const useResumeStore = create<ResumeStore>()(
  persist(
    (set, get) => ({
      ...defaultState,
      isParsing: false,
      isExtracting: false,
      isSearching: false,
      selectedFileName: null,
      errorMessage: null,

      setEnabled: (enabled) => {
        set({ enabled })
        get().syncToMain()
      },
      setJd: (jd) => {
        set({ jd })
        get().syncToMain()
      },
      setCompanyName: (companyName) => {
        set({ companyName })
        get().syncToMain()
      },
      setPriority: (key, value) => {
        set((s) => ({ priority: { ...s.priority, [key]: value } }))
        get().syncToMain()
      },
      setRawText: (rawText) => set({ rawText }),
      setStructured: (structured) => {
        set({ structured })
        get().syncToMain()
      },
      setCompanyInfo: (companyInfo) => {
        set({ companyInfo })
        get().syncToMain()
      },
      setIsParsing: (isParsing) => set({ isParsing }),
      setIsExtracting: (isExtracting) => set({ isExtracting }),
      setIsSearching: (isSearching) => set({ isSearching }),
      setSelectedFileName: (selectedFileName) => set({ selectedFileName }),
      setErrorMessage: (errorMessage) => set({ errorMessage }),
      clearResume: () => {
        set({ ...defaultState, isParsing: false, isExtracting: false, isSearching: false, selectedFileName: null, errorMessage: null })
        get().syncToMain()
      },
      syncToMain: () => {
        if (typeof window === 'undefined' || !window.api) return
        try {
          const s = get()
          window.api.updateResumeData({
            rawText: s.rawText,
            structured: s.structured,
            jd: s.jd,
            companyName: s.companyName,
            companyInfo: s.companyInfo,
            priority: s.priority,
            enabled: s.enabled
          })
        } catch {
          // API not ready yet (e.g. during initial rehydration)
        }
      }
    }),
    {
      name: 'interview-coder-resume',
      version: 1,
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (!error) useResumeStore.getState().syncToMain()
        }
      }
    }
  )
)
