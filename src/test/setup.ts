import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { server } from './mocks/server'

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => {
    server.resetHandlers()
    cleanup()
})

// Clean up after the tests are finished.
afterAll(() => server.close())

// Mock luxon's DateTime.now() to return a fixed date
vi.mock('luxon', () => ({
    DateTime: {
        now: vi.fn(() => ({
            setZone: vi.fn(() => ({
                startOf: vi.fn(() => ({
                    diff: vi.fn(() => ({ days: 1 })),
                })),
                diff: vi.fn(() => ({ minutes: 15 })),
                toFormat: vi.fn(() => '7:33 AM'),
            })),
        })),
    },
}))

// Mock matchMedia for Mantine components in jsdom
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        dispatchEvent: vi.fn(),
    })),
})

// Global mock for csvParser to prevent real file operations during any test
vi.mock('../server/utils/csvParser', () => ({
    readCsv: vi.fn().mockResolvedValue([
        { id: '1', btag: 'TestPlayer#1234', name: 'Test Player', challongeId: '12345' }
    ]),
    refreshDataCache: vi.fn().mockResolvedValue(undefined)
}))
