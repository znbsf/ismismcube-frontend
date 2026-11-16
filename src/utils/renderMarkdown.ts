import DOMPurify from 'dompurify'
import { marked } from 'marked'

type HtmlPurifier = Pick<typeof DOMPurify, 'isSupported' | 'sanitize'>

const escapedText = (text: string): string => `<pre>${String(text ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!)}</pre>`

/** Let Marked distinguish HTML from code literals, then sanitize the final HTML. */
export function renderSafeMarkdown(content: string, purifier: HtmlPurifier = DOMPurify): string {
  const text = String(content ?? '')
  try {
    // DOMPurify without a browser DOM is unsupported. Never return unfiltered HTML.
    if (!purifier.isSupported || typeof purifier.sanitize !== 'function') return escapedText(text)
    // Marked already preserves raw <think> HTML (including streaming fragments)
    // and escapes it inside code/codespan tokens. No placeholder rewrite needed.
    const html = marked(text, { async: false, breaks: true, gfm: true, pedantic: false }) as string
    return purifier.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['think'],
      FORBID_TAGS: ['style'],
      FORBID_ATTR: ['style'],
    }) as string
  } catch {
    return escapedText(text)
  }
}
