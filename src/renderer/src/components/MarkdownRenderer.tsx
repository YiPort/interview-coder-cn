import type { Components } from 'react-markdown'
import type { CSSProperties, ReactNode } from 'react'
import hljs from 'highlight.js/lib/common'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  cplusplus: 'cpp',
  'c++': 'cpp'
}

function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractTextContent).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return extractTextContent((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

function cleanCodeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/[ \t\n]+$/g, '')
}

function normalizeLanguage(language: string) {
  const normalized = language.toLowerCase()
  return languageAliases[normalized] || normalized
}

function getHighlightedHtml(text: string, language?: string) {
  if (!language) return null
  const normalizedLanguage = normalizeLanguage(language)
  if (!hljs.getLanguage(normalizedLanguage)) return null
  return hljs.highlight(text, { language: normalizedLanguage, ignoreIllegals: true }).value
}

const components: Components = {
  pre({ children }) {
    return (
      <pre
        data-code-scroll-container="true"
        className="!bg-[#0d1117] !p-0 !m-0 max-h-[70vh] overflow-auto"
      >
        {children}
      </pre>
    )
  },
  code({ className, children, ...props }) {
    const match = /language-([^\s]+)/.exec(className || '')
    const language = match?.[1]
    const isInline = !match && typeof children === 'string' && !children.includes('\n')

    if (isInline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }

    const textContent = cleanCodeText(extractTextContent(children))
    const lines = textContent ? textContent.split('\n') : ['']
    const lineCount = lines.length || 1
    const digits = String(lineCount).length
    const highlightedHtml = getHighlightedHtml(textContent, language)

    return (
      <div className="relative">
        {language && (
          <span className="absolute right-2 top-1 z-10 rounded bg-gray-800/90 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
            {language}
          </span>
        )}
        <div className="flex leading-4 text-[length:var(--ai-code-font-size)]">
          <span
            className="shrink-0 select-none text-right text-gray-500 border-r border-gray-700 py-2 pr-3 pl-4 bg-[#0d1117]"
            style={{ minWidth: `${digits + 2}ch` }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i} className="block">
                {i + 1}
              </span>
            ))}
          </span>
          <code
            className={`flex-1 !p-2 !bg-[#0d1117] whitespace-pre-wrap break-words ${className || ''}`}
            {...props}
            {...(highlightedHtml
              ? { dangerouslySetInnerHTML: { __html: highlightedHtml } }
              : { children: textContent })}
          />
        </div>
      </div>
    )
  }
}

export default function MarkdownRenderer({
  children,
  fontSize
}: {
  children: string
  fontSize: number
}) {
  const codeFontSize = Math.max(10, fontSize - 1)

  return (
    <div
      className="prose prose-invert max-w-none leading-snug prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-1 prose-blockquote:my-1 prose-pre:my-1 prose-pre:p-0"
      style={
        {
          fontSize: `${fontSize}px`,
          '--ai-code-font-size': `${codeFontSize}px`
        } as CSSProperties
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
