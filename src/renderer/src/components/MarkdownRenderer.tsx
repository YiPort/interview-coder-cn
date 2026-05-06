import type { Components } from 'react-markdown'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractTextContent).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return extractTextContent((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

const components: Components = {
  pre({ children }) {
    return <pre className="!bg-[#0d1117] !p-0 !m-0">{children}</pre>
  },
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const isInline = !match && typeof children === 'string' && !children.includes('\n')

    if (isInline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }

    const textContent = extractTextContent(children)
    const lines = textContent.split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    const lineCount = lines.length || 1
    const digits = String(lineCount).length

    return (
      <div className="flex text-xs leading-5">
        <span
          className="shrink-0 select-none text-right text-gray-500 border-r border-gray-700 py-3 pr-3 pl-4 bg-[#0d1117]"
          style={{ minWidth: `${digits + 2}ch` }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i} className="block">
              {i + 1}
            </span>
          ))}
        </span>
        <code
          className={`flex-1 !p-3 !bg-[#0d1117] whitespace-pre-wrap break-words ${className || ''}`}
          {...props}
        >
          {children}
        </code>
      </div>
    )
  }
}

export default function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-pre:p-0 prose-code:text-xs">
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
