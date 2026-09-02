import { describe, it, expect } from 'vitest'
import indexHtml from '../../index.html?raw'

const requiredTags: Array<{ label: string; pattern: RegExp }> = [
    {
        label: 'meta robots noindex',
        pattern: /<meta\s+name="robots"\s+content="[^"]*\bnoindex\b[^"]*"\s*\/?>/i,
    },
    {
        label: 'meta description',
        pattern: /<meta\s+name="description"\s+content="[^"]+"\s*\/?>/i,
    },
    {
        label: 'link canonical',
        pattern: /<link\s+rel="canonical"\s+href="https:\/\/[^"]+"\s*\/?>/i,
    },
    {
        label: 'og:title',
        pattern: /<meta\s+property="og:title"\s+content="[^"]+"\s*\/?>/i,
    },
    {
        label: 'og:description',
        pattern: /<meta\s+property="og:description"\s+content="[^"]+"\s*\/?>/i,
    },
    {
        label: 'og:url',
        pattern: /<meta\s+property="og:url"\s+content="https:\/\/[^"]+"\s*\/?>/i,
    },
    {
        label: 'og:type',
        pattern: /<meta\s+property="og:type"\s+content="website"\s*\/?>/i,
    },
    {
        label: 'og:image (absolute .png URL)',
        pattern:
            /<meta\s+property="og:image"\s+content="https:\/\/[^"]+\.png"\s*\/?>/i,
    },
    {
        label: 'og:image:alt',
        pattern: /<meta\s+property="og:image:alt"\s+content="[^"]+"\s*\/?>/i,
    },
    {
        label: 'twitter:card',
        pattern: /<meta\s+name="twitter:card"\s+content="[^"]+"\s*\/?>/i,
    },
]

describe('SEO meta tags in src/index.html', () => {
    it.each(requiredTags)('$label is present', ({ pattern }) => {
        expect(indexHtml).toMatch(pattern)
    })
})
