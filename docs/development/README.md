# Development Guide

> **Complete development resources** for SC2CR contributors and maintainers

Welcome to the SC2CR development documentation! This section provides everything you need to contribute effectively to the project.

---

## 🚀 Quick Start

New to SC2CR development? Follow this path:

1. **[Development Setup](setup.md)** - Get your local environment running
2. **[Development Workflow](workflow.md)** - Learn our Git flow and processes  
3. **[Contributing Guidelines](contributing.md)** - Code standards and review process
4. **[Testing Guide](testing.md)** - Testing strategy and best practices

---

## 📚 Development Resources

### 🔧 **Environment & Setup**
- **[Development Setup](setup.md)** - Complete local environment configuration
- **[Environment Variables](../reference/environment-variables.md)** - Configuration reference
- **[Troubleshooting](../getting-started/troubleshooting.md)** - Common setup issues

### 🔄 **Workflow & Process**
- **[Development Workflow](workflow.md)** - Git flow, branching strategy, and collaboration  
- **[Contributing Guidelines](contributing.md)** - Code standards, review process, and conventions
- **[Branching Strategy](../development-process/branching-strategy.md)** - Detailed Git workflow reference

### 🧪 **Quality Assurance**
- **[Testing Guide](testing.md)** - Unit tests, integration tests, and coverage
- **[Code Standards](contributing.md#code-standards)** - TypeScript, React, and API conventions
- **[CI/CD Pipeline](../architecture/deployment.md)** - Automated checks and deployments

### 🚀 **Deployment & Operations**
- **[Deployment Guide](deployment.md)** - Build, deploy, and environment management
- **[Architecture Overview](../architecture/README.md)** - System design and data flow
- **[API Documentation](../api/README.md)** - REST endpoints and integration

---

## 🎯 By Role

### **Frontend Developers**
1. [Development Setup](setup.md) → [Workflow](workflow.md) → [Testing](testing.md)
2. Focus: React components, TypeScript, Mantine UI, client-side architecture

### **Backend Developers**  
1. [Development Setup](setup.md) → [Contributing](contributing.md) → [API Docs](../api/README.md)
2. Focus: Express API, external integrations, caching, analytics

### **Full-Stack Contributors**
1. [Development Setup](setup.md) → [Workflow](workflow.md) → [Contributing](contributing.md) → [Testing](testing.md)
2. Focus: End-to-end features, API contracts, deployment pipeline

### **DevOps & Infrastructure**
1. [Deployment Guide](deployment.md) → [Architecture](../architecture/README.md) → [Environment Variables](../reference/environment-variables.md)
2. Focus: CI/CD, environment management, monitoring, performance

---

## 🛠️ Development Tools

### **Required Tools**
- **Node.js** 18.x+ with npm 9.x+
- **Git** for version control  
- **VS Code** (recommended) with project extensions
- **Docker** (optional) for containerized development

### **Recommended VS Code Extensions**
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

### **Essential Commands**
```bash
# Development
npm run dev              # Start full-stack development server
npm run build           # Build for production  
npm test               # Run all tests

# Quality Checks
npm run lint           # ESLint code style check
npm run type-check     # TypeScript validation
npm run coverage       # Test coverage report
```

---

## 📋 Development Checklist

### **First Contribution**
- [ ] Complete [development setup](setup.md)
- [ ] Read [contributing guidelines](contributing.md)  
- [ ] Understand [workflow process](workflow.md)
- [ ] Run tests successfully (`npm test`)
- [ ] Make first small improvement (docs, tests, or simple feature)

### **Before Each PR**
- [ ] Code follows [project conventions](contributing.md#code-standards)
- [ ] All tests pass (`npm test`)
- [ ] Code style checks pass (`npm run lint`)
- [ ] TypeScript validation passes (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)

### **Feature Development**
- [ ] Feature branch created from `dev`
- [ ] Tests written for new functionality
- [ ] Documentation updated if needed
- [ ] API endpoints documented (if applicable)
- [ ] Performance impact considered
- [ ] Security implications reviewed

---

## 🤝 Getting Help

### **Documentation**
- **Architecture Questions**: [Architecture Docs](../architecture/)
- **API Integration**: [API Reference](../api/)  
- **Setup Issues**: [Troubleshooting Guide](../getting-started/troubleshooting.md)

### **Community**
- **GitHub Issues**: Bug reports, feature requests, and questions
- **Code Review**: Learning opportunity through PR feedback

### **Mentorship**
New contributors receive support through:
- Paired code reviews with experienced maintainers
- Guided first contributions on beginner-friendly issues
- Documentation improvements as learning projects

---

## 🔄 Continuous Improvement

This development guide evolves with the project. Help us improve by:

- **Suggesting improvements** based on your development experience
- **Updating documentation** when you discover better workflows  
- **Adding examples** that help other developers
- **Identifying gaps** in our development resources

---

**Ready to contribute?** Start with [Development Setup](setup.md) → [Development Workflow](workflow.md)

*Last updated: October 2025 | [Improve this guide](https://github.com/KvCG/sc2crpage/edit/dev/docs/development/README.md)*