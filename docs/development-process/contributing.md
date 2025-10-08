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

### Code Standards

#### TypeScript & JavaScript
- **Prefer explicit types** over `any`
- **Use descriptive variable names** - readability over brevity
- **Functions should be small** - single responsibility
- **Avoid nested ternaries** - prefer clear if/else statements
- **Use early returns** to reduce nesting

#### React Components  
- **Use functional components** with hooks
- **Extract custom hooks** for shared logic
- **Props interfaces** should be explicit and documented
- **Component files** should use PascalCase
- **Test components** using React Testing Library with semantic queries

#### API Development
- **RESTful conventions** for endpoint naming
- **Proper HTTP status codes** for responses
- **Input validation** using schemas (Zod)
- **Error responses** follow `{ error, code, context? }` structure
- **API documentation** must be updated with new endpoints

#### Database & External APIs
- **Rate limiting** coordination across services
- **Caching strategies** with appropriate TTL
- **Error handling** with graceful degradation
- **Connection pooling** and resource cleanup

### Testing Requirements

#### Coverage Requirements
- **Minimum 85%** code coverage for both client and server
- **Unit tests** for all business logic
- **Integration tests** for API endpoints
- **Component tests** for complex UI logic

#### Test Organization
- **Client tests**: `src/client/**/*.test.{ts,tsx}`
- **Server tests**: `src/server/**/*.{test,spec}.{ts,tsx}`
- **Fixtures**: Use representative data in `src/test/fixtures/`
- **Mocks**: MSW for API mocking, avoid jest.mock() where possible

#### Test Quality
- **Descriptive test names** that explain the scenario
- **Arrange-Act-Assert** pattern for clarity
- **Test behavior, not implementation** details
- **Minimal mocking** - prefer real implementations when feasible

### Code Review Process

#### Before Submitting PR
```bash
# Run quality checks locally
npm run lint              # ESLint checks
npm run type-check        # TypeScript validation  
npm test                  # All tests pass
npm run build            # Build succeeds
```

#### PR Requirements
- **Clear title** following conventional commits format
- **Description** explaining what and why
- **Link to issue** if applicable
- **Screenshots** for UI changes
- **Test coverage** maintained or improved

#### Review Checklist
- [ ] Code follows project conventions
- [ ] Tests cover new functionality
- [ ] Documentation updated if needed
- [ ] No breaking changes to public APIs
- [ ] Performance considerations addressed
- [ ] Security implications considered

### Development Environment

#### Required Tools
- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher
- **Git**: Latest version
- **VS Code**: Recommended with SC2CR extension pack

#### VS Code Extensions
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint", 
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

#### Environment Setup
```bash
# Clone and setup
git clone https://github.com/KvCG/sc2crpage.git
cd sc2crpage
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start development
npm run dev
```

### Release Management

#### Version Numbering
We follow **Semantic Versioning** (semver):
- **Major**: Breaking changes (v2.0.0)
- **Minor**: New features, backwards compatible (v1.1.0)
- **Patch**: Bug fixes, backwards compatible (v1.0.1)

#### Release Schedule
- **Patch releases**: As needed for critical bugs
- **Minor releases**: Monthly feature releases
- **Major releases**: Planned architectural changes

#### Release Checklist
- [ ] All tests passing in CI
- [ ] Documentation updated
- [ ] Changelog generated from commits
- [ ] Version bumped appropriately
- [ ] Release notes prepared
- [ ] Deployment verified in staging

### Getting Help

#### Documentation
- **Architecture**: [docs/architecture/](../architecture/)
- **API Reference**: [docs/api/](../api/)
- **Troubleshooting**: [docs/getting-started/troubleshooting.md](../getting-started/troubleshooting.md)

#### Communication
- **GitHub Issues**: Bug reports, feature requests, and general questions
- **Discord**: Real-time collaboration (link in project README)

#### Mentorship
New contributors are paired with experienced team members:
- **Code reviews** provide learning opportunities
- **Pairing sessions** available for complex features
- **Documentation contributions** are a great starting point

---

## Quick Reference

### Essential Commands
```bash
npm run dev              # Start development servers
npm run build           # Build for production
npm test               # Run all tests
npm run lint           # Check code style
npm run type-check     # Verify TypeScript
```

### Git Workflow
```bash
git checkout dev && git pull           # Start from latest dev
git checkout -b feature/my-feature     # Create feature branch
# ... make changes ...
git commit -m "feat: add new feature"  # Commit with conventional format
git push origin feature/my-feature     # Push to remote
# ... open PR targeting dev branch ...
```

### Environment Quick Setup
```bash
# Required environment variables
CHALLONGE_API_KEY=<your-key>
GOOGLE_SERVICE_ACCOUNT_KEY=<json-string>
PORT=3000

# Optional but recommended
RANKING_MIN_GAMES=10
MMR_RANGE_FOR_PREMIER_MATCH=400
```

---

*For detailed setup instructions, see [Getting Started Guide](../getting-started/README.md)*