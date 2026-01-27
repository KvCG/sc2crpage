# Contributing Guidelines

Welcome to the SC2CR project! This guide covers our development workflow, coding standards, and contribution process.

## Development Workflow

### Branching Strategy

We use **trunk-based development** with `dev` as our integration branch:

```
main     ──●────●────●────●──  (releases only)
             \       /
dev          ●─●─●─●─●─●─●──  (integration branch)
                \   /
feature           ●─●──────  (feature branches)
```

#### Day-to-Day Development
```bash
# Start from dev branch
git checkout dev
git pull origin dev

# Option 1: Work directly on dev (for small changes)
# Make your changes and commit

# Option 2: Create feature branch (for larger work)
git checkout -b feature/my-feature-name
# Make your changes and commit
git push origin feature/my-feature-name
# Open PR targeting dev branch
```

#### Release Process
```bash
# 1. Create release preparation branch
git checkout dev
git pull origin dev
git checkout -b temp-release-prep

# 2. Curate changes using interactive rebase
git rebase -i origin/main
# Use pick/squash/drop to select only the changes for this release

# 3. Create release branch from main
git checkout main
git pull origin main  
git checkout -b release/v1.2.3

# 4. Merge curated changes
git merge --no-ff temp-release-prep

# 5. Open PR to main
# After merge, tag the release
git tag v1.2.3
git push origin main --tags

# 6. Clean up
git branch -d temp-release-prep
git branch -d release/v1.2.3
```

**Important Rules:**
- ✅ **DO**: Create PRs from feature branches to `dev`
- ✅ **DO**: Work directly on `dev` for small changes
- ✅ **DO**: Curate releases by cherry-picking from `dev` to `main`
- ❌ **DON'T**: Merge `dev` into `main` directly
- ❌ **DON'T**: Create PRs directly to `main` (releases only)

### Commit Message Format

We follow **Conventional Commits** specification:

```
<type>(<scope>): <description> [<ticket-id>]

<body>

<footer>
```

#### Examples
```bash
feat(api): add player analytics endpoint [BL-012]
fix(client): resolve ranking display issue
docs(readme): update setup instructions
refactor(server): extract cache service module
test(analytics): add unit tests for delta computation
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to build process or auxiliary tools

#### Scopes
- `client`: Frontend React application
- `server`: Backend Express application
- `api`: API endpoints and routes
- `ui`: User interface components
- `config`: Configuration changes
- `deps`: Dependency updates

## Code Standards

### General Principles

**Readability is mandatory.** Generate code that is:
- ✅ Easy to read and understand
- ✅ Easy to maintain and modify
- ✅ Consistent with existing patterns
- ❌ Not overly clever or compressed
- ❌ Not using nested ternaries or obscure logic

### Naming Conventions

```typescript
// Components: PascalCase
export function PlayerCard({ player }: PlayerCardProps) {}

// Hooks and utilities: camelCase  
export function useFetch(endpoint: string) {}
export function formatPlayerName(name: string) {}

// Files: Follow directory patterns
components/PlayerCard.tsx        // PascalCase for components
hooks/useFetch.tsx              // camelCase for hooks  
services/pulseApi.ts            // camelCase for services
utils/formatData.ts             // camelCase for utilities

// Constants: UPPER_SNAKE_CASE
export const MAX_RETRY_ATTEMPTS = 3
export const API_TIMEOUT_MS = 5000
```

### Error Handling

Use consistent error structure:
```typescript
// Error response format
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Human-readable error message',
    context?: { /* Additional debugging info */ }
  }
}

// Service error handling
try {
  const data = await externalService.fetch()
  return { success: true, data }
} catch (error) {
  logger.error({ error, context: { endpoint } }, 'Service call failed')
  return { 
    success: false, 
    error: { code: 'EXTERNAL_API_ERROR', message: 'Service unavailable' }
  }
}
```

### TypeScript Guidelines

```typescript
// Use strict typing
interface PlayerData {
  id: number
  btag: string
  name?: string          // Optional fields explicitly marked
  race: 'Terran' | 'Protoss' | 'Zerg' | 'Random'  // Use unions over enums
}

// Avoid 'any' - use unknown or specific types
function processApiResponse(data: unknown): PlayerData {
  // Validate and type-guard the data
  if (!isValidPlayerData(data)) {
    throw new Error('Invalid player data')
  }
  return data
}

// Generic functions when reusable
function createApiCall<T>(endpoint: string): Promise<T> {
  return api.get<T>(endpoint)
}
```

### Testing Standards

```typescript
// Descriptive test names
describe('PlayerCard component', () => {
  it('displays player battle tag and rating', () => {
    // Test implementation
  })

  it('shows loading state while data is fetching', () => {
    // Test implementation  
  })

  it('handles missing player data gracefully', () => {
    // Test implementation
  })
})

// Use fixtures for complex data
const mockPlayerData = {
  id: 1,
  btag: 'TestPlayer#1234',
  name: 'Test Player',
  race: 'Terran' as const,
  rating: 4500
}

// Mock external dependencies
vi.mock('../services/pulseApi', () => ({
  getRanking: vi.fn().mockResolvedValue(mockPlayerData)
}))
```

## Feature Development

### Feature Flags

All new features should use feature flags for gradual rollout:

```typescript
// Environment variable pattern
ENABLE_FEATURE_NAME=false

// Implementation pattern
export const featureFlags = {
  playerAnalytics: () => process.env.ENABLE_PLAYER_ANALYTICS === 'true',
  dataSnapshots: () => process.env.ENABLE_DATA_SNAPSHOTS === 'true'
} as const

// Route protection
router.get('/analytics', requireFeatureFlag(featureFlags.playerAnalytics), handler)
```

### API Development

Follow established patterns:
```typescript
// Route structure
router.get('/endpoint', middleware, async (req: Request, res: Response) => {
  try {
    // Validate input
    const { param } = req.query
    
    // Business logic in service layer
    const result = await service.processData(param)
    
    // Consistent response format
    res.json({
      success: true,
      data: result,
      metadata: { timestamp: new Date().toISOString() }
    })
  } catch (error) {
    logger.error({ error, endpoint: req.path }, 'Endpoint failed')
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Processing failed' }
    })
  }
})
```

### Service Layer

Keep services focused and testable:
```typescript
// Single responsibility
export class PlayerService {
  constructor(
    private httpClient: HttpClient,
    private cache: CacheService
  ) {}

  async getPlayerData(id: string): Promise<PlayerData> {
    // Implementation with clear error handling
  }
}

// Dependency injection
const playerService = new PlayerService(
  new HttpClient(),
  new CacheService()
)
```

## Pull Request Process

### Before Submitting
1. **Run Tests**: `npm test` - All tests must pass
2. **Type Check**: `npm run type-check` - No TypeScript errors
3. **Lint**: `npm run lint` - Follow code style
4. **Build**: `npm run build` - Ensure production build works
5. **Self-Review**: Check your own diff for obvious issues

### PR Requirements
- **Clear Title**: Describe what the PR accomplishes
- **Description**: Explain the changes and reasoning
- **Testing**: Describe how the changes were tested
- **Screenshots**: For UI changes, include before/after images
- **Breaking Changes**: Clearly mark any breaking changes

### PR Template
```markdown
## Summary
Brief description of changes

## Changes Made
- [ ] Added new feature X
- [ ] Fixed bug Y  
- [ ] Updated documentation Z

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Edge cases considered

## Screenshots (if applicable)
[Include screenshots for UI changes]

## Breaking Changes
[List any breaking changes and migration notes]
```

### Review Process
1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: At least one maintainer approval required
3. **Testing**: Reviewer should test the changes locally
4. **Documentation**: Ensure docs are updated if needed

## Local Development

### Quality Checks
```bash
# Run before committing
npm run type-check    # TypeScript errors
npm run lint         # ESLint issues
npm test            # All tests
npm run build       # Production build

# Fix common issues
npm run lint --fix   # Auto-fix linting issues
```

### Git Hooks (Optional)
Set up pre-commit hooks to catch issues early:
```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run type-check && npm run lint && npm test"
```

## Documentation

### When to Update Docs
- ✅ **New APIs**: Document endpoints, parameters, responses
- ✅ **Configuration Changes**: Update environment variables, setup instructions
- ✅ **Architecture Changes**: Update architecture diagrams and explanations
- ✅ **Breaking Changes**: Update migration guides and version notes

### Documentation Standards
- Use clear, concise language
- Include code examples for complex concepts
- Update both inline comments and external documentation
- Keep README.md up to date with major changes

## Getting Help

### Communication Channels
- **Issues**: GitHub issues for bugs, feature requests, and questions
- **Maintainers**: Contact NeO or Kerverus for urgent issues

### Common Questions
- **"Where should I put this code?"**: Follow existing directory patterns
- **"How do I test external APIs?"**: Use MSW mocks in test files
- **"What's the deployment process?"**: See CI/CD workflow documentation
- **"Can I change the architecture?"**: Discuss major changes in issues first

## Performance Guidelines

### Client-Side
- Use React.memo() for expensive components
- Implement proper loading states
- Cache API responses appropriately
- Optimize images and assets

### Server-Side  
- Keep services stateless for horizontal scaling
- Use appropriate cache TTLs
- Implement proper error boundaries
- Monitor external API rate limits

## Security Considerations

- Never commit API keys or secrets
- Validate all user inputs
- Use environment variables for configuration
- Follow principle of least privilege for access

---

Thank you for contributing to SC2CR! 🚀