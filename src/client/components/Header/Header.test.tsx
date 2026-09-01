import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import { Header } from './Header'

/** Extract the declaration block for a selector using brace matching (handles nested @mixin blocks). */
function extractBlock(css: string, selectorPattern: RegExp): string {
    const match = css.match(selectorPattern)
    if (!match) throw new Error(`selector not found: ${selectorPattern}`)
    const open = css.indexOf('{', match.index!)
    let depth = 0
    for (let i = open; i < css.length; i++) {
        if (css[i] === '{') depth++
        else if (css[i] === '}') {
            depth--
            if (depth === 0) return css.slice(open + 1, i)
        }
    }
    throw new Error('unbalanced braces')
}

const cssPath = join(__dirname, 'Header.module.css')
const css = readFileSync(cssPath, 'utf-8')
const baseLink = extractBlock(css, /\.link\s*\{/)
const activeLink = extractBlock(css, /\[data-active\]\s*\{/)

describe('Header.module.css — SC2 contract (S20 T2)', () => {
    it('active tab: underline steel (blue-4) 2px, no filled background, no 15px font-size', () => {
        expect(activeLink).toMatch(/box-shadow:\s*inset 0 -2px 0 var\(--mantine-color-blue-4\)/)
        expect(activeLink).not.toContain('background-color')
        expect(css).not.toMatch(/font-size:\s*15px/)
    })

    it('active tab keeps white text and uses font-weight 600', () => {
        expect(activeLink).toMatch(/color:\s*var\(--mantine-color-white\)/)
        expect(activeLink).toMatch(/font-weight:\s*600/)
    })

    it('base .link: 13px display font, uppercase, weight 500 (no size jump between active/inactive)', () => {
        expect(baseLink).toMatch(/font-size:\s*rem\(13px\)/)
        expect(baseLink).toMatch(/font-family:\s*var\(--mantine-font-family-headings\)/)
        expect(baseLink).toMatch(/text-transform:\s*uppercase/)
        expect(baseLink).toMatch(/font-weight:\s*500/)
        expect(baseLink).not.toContain('15px')
    })

    it('header keeps its bottom border', () => {
        const header = extractBlock(css, /\.header\s*\{/)
        expect(header).toMatch(/border-bottom:/)
    })
})

describe('Header — mobile menu parity', () => {
    const renderHeader = (path: string) =>
        render(
            <MantineProvider>
                <MemoryRouter initialEntries={[path]}>
                    <Header />
                </MemoryRouter>
            </MantineProvider>
        )

    it('marks only the current route active on the desktop tabs', () => {
        renderHeader('/h2h')
        const links = Array.from(
            screen.getAllByText('Head to Head').map((el) => el as HTMLElement)
        )
        expect(links.length).toBe(1)
        expect(links[0].getAttribute('data-active')).not.toBeNull()
        const ranking = screen.getByText('Ranking') as HTMLElement
        expect(ranking.getAttribute('data-active')).toBeNull()
    })

    it('mobile menu items are wired with the same .link class and data-active as desktop (underline parity)', () => {
        // Mantine's Menu.Dropdown does not mount in jsdom (floating-ui/transition
        // requirement — verified with a plain uncontrolled Menu, which fails to open
        // the same way), so parity is asserted on the wiring: both the desktop
        // `items` and the mobile `mobileItems` must use classes.link + the same
        // data-active expression. The shared CSS rule then applies to both.
        const src = readFileSync(join(__dirname, 'Header.tsx'), 'utf-8')
        const classUsages = src.match(/className=\{classes\.link\}/g) ?? []
        const activeUsages = src.match(/data-active=\{active === link\.link \|\| undefined\}/g) ?? []
        expect(classUsages.length, 'expected desktop + mobile link wiring').toBe(2)
        expect(activeUsages.length, 'expected desktop + mobile data-active wiring').toBe(2)
    })
})
