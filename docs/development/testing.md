# Testing Guide

This guide covers testing patterns, tools, and best practices for the SC2CR project.

## Overview

SC2CR uses **Vitest** as the primary testing framework with separate configurations for client and server code.

### Testing Stack
- **Test Runner**: Vitest (Vite-native, fast, ESM support)
- **Client Environment**: jsdom (browser simulation)
- **Server Environment**: Node.js 
- **Mocking**: Mock Service Worker (MSW) for API calls
- **Assertions**: Vitest built-in assertions + @testing-library/jest-dom
- **Coverage**: V8 provider with HTML reports

## Quick Start

### Commands
```bash
# Run all tests (client + server)
npm test

# Client tests only
npm run test:client

# Server tests only  
npm run test:server

# Watch mode (client tests)
npm run test:watch

# Coverage reports
npm run coverage

# Individual coverage
npm run test:coverage:client
npm run test:coverage:server
```

### Test File Patterns
```bash
# Client tests
src/client/**/*.{test,spec}.{ts,tsx}

# Server tests  
src/server/**/*.{test,spec}.{ts,tsx}
src/server/**/__tests__/**/*.{test,spec}.{ts,tsx}
```

## Configuration

### Client Configuration (`vitest.client.config.ts`)
```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/client/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/client/**'],
      exclude: [/* standard exclusions */]
      // Coverage thresholds commented out - configure as needed
    }
  }
})
```

### Server Configuration (`vitest.server.config.ts`)
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/server/**/*.{test,spec}.{ts,tsx}',
      'src/server/**/__tests__/**/*.{test,spec}.{ts,tsx}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/server/**'],
      exclude: [/* standard exclusions */]
      // Coverage thresholds commented out - configure as needed
    }
  }
})
```

### Test Setup (`src/test/setup.ts`)
```typescript
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'
import '@testing-library/jest-dom'

// MSW server setup
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Testing Patterns

### Client Component Testing

#### Basic Component Test
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerCard from '../PlayerCard'

describe('PlayerCard', () => {
  it('displays player information correctly', () => {
    const player = {
      btag: 'TestPlayer#1234',
      name: 'Test Player',
      rating: 4500,
      race: 'Terran'
    }

    render(<PlayerCard player={player} />)

    expect(screen.getByText('TestPlayer#1234')).toBeInTheDocument()
    expect(screen.getByText('4500')).toBeInTheDocument()
    expect(screen.getByText('Terran')).toBeInTheDocument()
  })

  it('handles missing optional fields gracefully', () => {
    const player = {
      btag: 'TestPlayer#1234',
      rating: 4500,
      race: 'Terran'
      // name is optional and missing
    }

    render(<PlayerCard player={player} />)
    
    // Should still render btag even without name
    expect(screen.getByText('TestPlayer#1234')).toBeInTheDocument()
  })
})
```

#### Hook Testing
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useFetch } from '../hooks/useFetch'

describe('useFetch', () => {
  it('fetches data successfully', async () => {
    const { result } = renderHook(() => useFetch('top'))

    // Initially loading
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBe(null)

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
    expect(result.current.error).toBe(null)
  })
})
```

#### User Interaction Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('SearchBar', () => {
  it('calls onSearch when form is submitted', async () => {
    const user = userEvent.setup()
    const mockOnSearch = vi.fn()

    render(<SearchBar onSearch={mockOnSearch} />)

    const input = screen.getByPlaceholderText('Search players...')
    const submitButton = screen.getByRole('button', { name: /search/i })

    await user.type(input, 'TestPlayer#1234')
    await user.click(submitButton)

    expect(mockOnSearch).toHaveBeenCalledWith('TestPlayer#1234')
  })
})
```

### Server Testing

#### Route Testing
```typescript
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import pulseRoutes from '../routes/pulseRoutes'

// Mock the service layer
vi.mock('../services/pulseService', () => ({
  pulseService: {
    getRanking: vi.fn().mockResolvedValue([
      { id: 1, btag: 'Player#1234', rating: 4500 }
    ])
  }
}))

describe('Pulse Routes', () => {
  const app = express()
  app.use(express.json())
  app.use('/api', pulseRoutes)

  it('GET /api/top returns ranking data', async () => {
    const response = await request(app)
      .get('/api/top')
      .expect(200)

    expect(response.body).toHaveLength(1)
    expect(response.body[0]).toHaveProperty('btag', 'Player#1234')
    expect(response.headers['x-sc2pulse-attribution']).toBeDefined()
  })

  it('handles errors gracefully', async () => {
    // Mock service to throw error
    const { pulseService } = await import('../services/pulseService')
    vi.mocked(pulseService.getRanking).mockRejectedValueOnce(new Error('API Error'))

    const response = await request(app)
      .get('/api/top')
      .expect(500)

    expect(response.body).toHaveProperty('error', 'Failed to fetch ranking data')
  })
})
```

#### Service Testing
```typescript
import { describe, it, expect, vi } from 'vitest'
import { pulseService } from '../services/pulseService'

// Mock HTTP client
vi.mock('../services/pulseHttpClient', () => ({
  pulseHttpClient: {
    get: vi.fn()
  }
}))

describe('PulseService', () => {
  it('fetches and formats ranking data', async () => {
    const mockResponse = {
      data: [
        {
          character: { id: 1 },
          account: { battleTag: 'Player#1234' },
          ratingLast: 4500,
          race: 'TERRAN'
        }
      ]
    }

    const { pulseHttpClient } = await import('../services/pulseHttpClient')
    vi.mocked(pulseHttpClient.get).mockResolvedValueOnce(mockResponse)

    const result = await pulseService.getRanking()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 1,
      btag: 'Player#1234', 
      rating: 4500,
      race: 'Terran'
    })
  })
})
```

### Utility Testing
```typescript
import { describe, it, expect } from 'vitest'
import { formatPlayerName, calculatePositionChange } from '../utils/playerUtils'

describe('Player Utilities', () => {
  describe('formatPlayerName', () => {
    it('formats battle tag correctly', () => {
      expect(formatPlayerName('Player#1234')).toBe('Player')
    })

    it('handles names without hash', () => {
      expect(formatPlayerName('PlayerName')).toBe('PlayerName')
    })

    it('handles empty input', () => {
      expect(formatPlayerName('')).toBe('')
    })
  })

  describe('calculatePositionChange', () => {
    it('calculates upward movement', () => {
      const result = calculatePositionChange(5, 10)
      expect(result).toEqual({
        direction: 'up',
        change: 5,
        indicator: 'up'
      })
    })

    it('handles no change', () => {
      const result = calculatePositionChange(5, 5)
      expect(result).toEqual({
        direction: 'none',
        change: 0,
        indicator: 'none'
      })
    })
  })
})
```

## Mocking Strategies

### API Mocking with MSW

#### Setup (`src/test/mocks/server.ts`)
```typescript
import { setupServer } from 'msw/node'
import { rest } from 'msw'

const handlers = [
  rest.get('https://sc2pulse.nephest.com/sc2/api/character/search', (req, res, ctx) => {
    const term = req.url.searchParams.get('term')
    return res(ctx.json([
      {
        character: { id: 1 },
        account: { battleTag: `${term}#1234` },
        ratingLast: 4500
      }
    ]))
  }),

  rest.get('/api/top', (req, res, ctx) => {
    return res(ctx.json([
      { id: 1, btag: 'Player#1234', rating: 4500, race: 'Terran' }
    ]))
  })
]

export const server = setupServer(...handlers)
```

#### Runtime Handler Override
```typescript
it('handles API errors', async () => {
  // Override handler for this test
  server.use(
    rest.get('/api/top', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ error: 'Server error' }))
    })
  )

  const { result } = renderHook(() => useFetch('top'))
  
  await waitFor(() => {
    expect(result.current.error).toBe('Server error')
  })
})
```

### Service Mocking
```typescript
// Mock external dependencies
vi.mock('../services/pulseHttpClient', () => ({
  pulseHttpClient: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

// Mock with specific return values
const mockGet = vi.fn().mockResolvedValue({ data: [] })
const mockPost = vi.fn().mockResolvedValue({ success: true })

vi.mocked(pulseHttpClient.get).mockImplementation(mockGet)
vi.mocked(pulseHttpClient.post).mockImplementation(mockPost)
```

## Test Data & Fixtures

### Creating Fixtures
```typescript
// src/test/fixtures/playerData.ts
export const mockPlayer = {
  id: 1,
  btag: 'TestPlayer#1234',
  name: 'Test Player',
  rating: 4500,
  race: 'Terran' as const,
  leagueType: 6,
  gamesPlayed: 150,
  daysSinceLastGame: 1
}

export const mockRankingData = [
  mockPlayer,
  { ...mockPlayer, id: 2, btag: 'Player2#5678', rating: 4300 }
]

// Use in tests
import { mockPlayer, mockRankingData } from '../fixtures/playerData'
```

### Scenario-Based Fixtures
```typescript
// src/test/fixtures/scenarios.ts
export const scenarios = {
  emptyRanking: [],
  singlePlayer: [mockPlayer],
  fullRanking: mockRankingData,
  withInactivePlayers: [
    ...mockRankingData,
    { ...mockPlayer, id: 3, daysSinceLastGame: 30 }
  ]
}
```

## Coverage Guidelines

### Current Status
- **Coverage Thresholds**: Currently commented out in configs
- **Target**: 85% lines/statements/functions/branches (when implemented)
- **Reports**: HTML reports generated in `coverage/` directory

### Coverage Best Practices
```typescript
// Focus on critical paths
describe('Authentication', () => {
  it('handles successful login', () => {
    // Test happy path
  })

  it('handles invalid credentials', () => {
    // Test error path  
  })

  it('handles network errors', () => {
    // Test edge cases
  })
})

// Don't test implementation details
// ❌ Bad: Testing internal state
expect(component.state.loading).toBe(true)

// ✅ Good: Testing behavior
expect(screen.getByText('Loading...')).toBeInTheDocument()
```

### Running Coverage
```bash
# Generate coverage reports
npm run coverage

# View HTML report
open coverage/index.html

# Check specific thresholds
npx vitest run --coverage --reporter=verbose
```

## Debugging Tests

### VS Code Configuration
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "--reporter=verbose"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Common Debugging Patterns
```typescript
// Add debug output
it('should process data correctly', () => {
  const result = processData(input)
  console.log('Debug result:', result) // Temporary debug
  expect(result).toEqual(expected)
})

// Use screen.debug() for DOM issues
it('renders component correctly', () => {
  render(<Component />)
  screen.debug() // Prints current DOM to console
  expect(screen.getByText('Expected Text')).toBeInTheDocument()
})

// Isolate failing tests
it.only('this test only', () => {
  // Only this test will run
})

it.skip('skip this test', () => {
  // This test will be skipped
})
```

## Performance Testing

### Timing Tests
```typescript
import { performance } from 'perf_hooks'

it('processes large datasets efficiently', async () => {
  const start = performance.now()
  
  const result = await processLargeDataset(largeInput)
  
  const end = performance.now()
  const duration = end - start
  
  expect(duration).toBeLessThan(1000) // Should complete in under 1 second
  expect(result).toBeDefined()
})
```

### Memory Leak Testing
```typescript
it('does not leak memory', () => {
  const initialMemory = process.memoryUsage().heapUsed
  
  // Perform operations that might leak memory
  for (let i = 0; i < 1000; i++) {
    createAndDestroyComponent()
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }
  
  const finalMemory = process.memoryUsage().heapUsed
  const memoryIncrease = finalMemory - initialMemory
  
  // Should not increase significantly
  expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB threshold
})
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm test

- name: Generate Coverage  
  run: npm run coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

### Quality Gates
- All tests must pass before merge
- Coverage reports generated on every PR
- Type checking must pass
- Linting must pass

## Troubleshooting

### Common Issues

#### MSW Not Working
```bash
# Ensure MSW is properly set up
npm install --save-dev msw
# Check that server.ts is imported in setup.ts
```

#### jsdom Environment Issues
```typescript
// Add to test file if needed
/**
 * @vitest-environment jsdom
 */
```

#### Async Test Timing Out
```typescript
// Increase timeout for slow tests
it('slow async operation', async () => {
  // Test implementation
}, 10000) // 10 second timeout
```

#### Module Import Issues
```typescript
// Use dynamic imports for modules that need mocking
it('handles module correctly', async () => {
  const { someFunction } = await import('../moduleToTest')
  // Test with dynamically imported module
})
```

## Best Practices

### Test Organization
- Group related tests with `describe` blocks
- Use descriptive test names that explain behavior
- Keep tests focused on single behavior
- Use `beforeEach`/`afterEach` for setup/cleanup

### Test Maintainability
- Extract common setup to helper functions
- Use fixtures for complex test data
- Keep tests independent (no shared state)
- Update tests when refactoring code

### Performance
- Avoid unnecessary DOM queries
- Use `screen.getByRole` over `querySelector`
- Mock expensive operations
- Run tests in parallel when possible

---

Happy testing! 🧪