# Documentation Index

Welcome to the **Global Health Checks** documentation. This directory contains comprehensive documentation covering all aspects of the project.

## 📚 Documentation Structure

### Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Project goals, features, and use cases | Everyone |
| [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | System architecture and technical design | Developers, Architects |
| [MULTI_REGION_DEPLOYMENT.md](MULTI_REGION_DEPLOYMENT.md) | Multi-region testing setup and deployment | DevOps, Developers |
| [TESTING_INFRASTRUCTURE.md](TESTING_INFRASTRUCTURE.md) | Testing strategy and implementation | Developers, QA |
| [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) | Developer workflow and coding standards | Contributors |
| [PROJECT_HISTORY.md](PROJECT_HISTORY.md) | Timeline, changelog, and decisions | Project Managers |

### Quick Links

- **Getting Started**: See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#getting-started)
- **API Reference**: See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md#api-endpoints)
- **Testing Guide**: See [TESTING_INFRASTRUCTURE.md](TESTING_INFRASTRUCTURE.md)
- **Architecture Diagrams**: See [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)
- **Changelog**: See [PROJECT_HISTORY.md](PROJECT_HISTORY.md#detailed-changelog)

## 📖 Document Summaries

### PROJECT_OVERVIEW.md
**What it covers**:
- Project description and purpose
- Primary and secondary goals
- Technology stack with justifications
- Key features (TCP testing, region hints, batch testing)
- API endpoint specifications
- Use cases (monitoring, debugging, latency testing)
- Project structure
- Deployment instructions
- Requirements and limitations
- Future roadmap

**When to read**: Start here for project introduction and high-level understanding.

### MULTI_REGION_DEPLOYMENT.md
**What it covers**:
- Multi-region testing architecture
- Regional Worker deployment configuration
- DNS setup for 6 regional subdomains
- Frontend routing logic for regional endpoints
- Authentication and deployment procedures
- Testing and verification methods
- Troubleshooting common issues
- Cost analysis and scalability
- Cloudflare Workers limitations
- Alternative approaches comparison
- Maintenance and update procedures

**When to read**: When deploying or maintaining the multi-region setup.

### TECHNICAL_ARCHITECTURE.md
**What it covers**:
- System architecture diagrams
- Component architecture (frontend + backend)
- Request/response flow
- Data models and TypeScript interfaces
- Cloudflare Workers Sockets API integration
- State management patterns
- Error handling strategies
- Performance optimization
- Security architecture
- Deployment architecture
- Scalability considerations

**When to read**: When you need to understand how the system works internally.

### TESTING_INFRASTRUCTURE.md
**What it covers**:
- Testing stack overview (Vitest, RTL, MSW)
- Testing philosophy and best practices
- Test structure and organization
- Unit, integration, and snapshot testing
- Tailwind class verification
- MSW API mocking setup
- Test utilities and helpers
- Coverage reports and thresholds
- CI/CD integration
- Debugging tests
- Performance metrics

**When to read**: Before writing tests or modifying test infrastructure.

### DEVELOPMENT_GUIDE.md
**What it covers**:
- Getting started (prerequisites, setup)
- Development workflow
- Project scripts
- Code organization
- Coding standards (TypeScript, React, CSS)
- Testing guidelines
- Git workflow and commit conventions
- Debugging techniques
- Common issues and solutions
- Performance optimization
- Security best practices
- Environment variables

**When to read**: When starting development or contributing to the project.

### PROJECT_HISTORY.md
**What it covers**:
- Complete project timeline
- Detailed changelog with commit hashes
- Key technical decisions with rationale
- Development insights and challenges
- Best practices established
- Project statistics
- Future roadmap
- Lessons learned

**When to read**: To understand project evolution and decision-making context.

## 🎯 Documentation by Role

### New Contributors
**Start here**:
1. [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Understand the project
2. [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) - Set up development environment
3. [TESTING_INFRASTRUCTURE.md](TESTING_INFRASTRUCTURE.md) - Learn testing practices

### Developers
**Focus on**:
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - Understand system design
- [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) - Follow coding standards
- [TESTING_INFRASTRUCTURE.md](TESTING_INFRASTRUCTURE.md) - Write effective tests

### DevOps Engineers
**Focus on**:
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md#deployment-architecture) - Deployment setup
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md#deployment) - Deployment commands
- [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#environment-variables) - Environment config

### Project Managers
**Focus on**:
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Feature overview
- [PROJECT_HISTORY.md](PROJECT_HISTORY.md) - Progress tracking
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md#future-enhancements) - Roadmap

### QA Engineers
**Focus on**:
- [TESTING_INFRASTRUCTURE.md](TESTING_INFRASTRUCTURE.md) - Testing strategy
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md#use-cases) - Test scenarios
- [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#debugging) - Debugging techniques

### Architects
**Focus on**:
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - System design
- [PROJECT_HISTORY.md](PROJECT_HISTORY.md#key-technical-decisions) - Design decisions
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md#scalability) - Scalability

## 🔍 Documentation by Task

### Setting Up Development Environment
→ [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#initial-setup)

### Understanding the API
→ [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md#api-endpoints)

### Writing Tests
→ [TESTING_INFRASTRUCTURE.md](TESTING_INFRASTRUCTURE.md#testing-best-practices)

### Deploying to Production
→ [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md#deployment)

### Adding a New Feature
1. [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - Understand architecture
2. [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#coding-standards) - Follow standards
3. [TESTING_INFRASTRUCTURE.md](TESTING_INFRASTRUCTURE.md) - Write tests
4. [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#git-workflow) - Create PR

### Debugging an Issue
→ [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#debugging)

### Understanding System Architecture
→ [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)

### Contributing to the Project
→ [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#pull-request-process)

## 📊 Documentation Coverage

### What's Documented
- ✅ Project goals and requirements
- ✅ Complete technical architecture
- ✅ Comprehensive testing strategy
- ✅ Developer workflow and standards
- ✅ API specifications
- ✅ Data models and interfaces
- ✅ Deployment procedures
- ✅ Security best practices
- ✅ Performance optimization
- ✅ Complete project history
- ✅ All conversation context
- ✅ Technical decision rationale

### Documentation Quality Metrics
- **Completeness**: 100% (all aspects covered)
- **Accuracy**: Current as of February 7, 2026
- **Clarity**: Technical and non-technical audiences
- **Depth**: From high-level overview to implementation details
- **Maintainability**: Structured, versioned, cross-referenced

## 🔄 Keeping Documentation Updated

### When to Update

**Update immediately**:
- New features added
- API changes
- Architecture modifications
- Breaking changes
- Security updates

**Update regularly**:
- Performance optimizations
- Bug fixes
- Dependency updates
- New test cases

### How to Update

1. **Identify affected documents**: Use the table above
2. **Make changes**: Edit markdown files
3. **Update version numbers**: At bottom of each doc
4. **Cross-reference**: Update links between docs
5. **Commit with message**: `docs: update [document] for [reason]`

### Version Numbers

Each document has a version number at the bottom:
```markdown
**[Document Name] Version**: 1.0
**Last Updated**: February 7, 2026
```

Increment version:
- **Major (1.0 → 2.0)**: Complete restructure
- **Minor (1.0 → 1.1)**: New sections added
- **Patch (1.0 → 1.0.1)**: Small corrections

## 📝 Documentation Standards

### Markdown Formatting

- Use **ATX-style headers** (`#`, `##`, `###`)
- **Code blocks** with language: ` ```typescript`
- **Tables** for structured data
- **Lists** for sequential information
- **Bold** for emphasis, **italics** for technical terms
- **Links** for cross-references

### File Naming

- Use `SCREAMING_SNAKE_CASE` for main docs
- Use `.md` extension
- Be descriptive: `TECHNICAL_ARCHITECTURE.md` not `ARCH.md`

### Structure

Each document should have:
1. **Title** (H1)
2. **Overview** section
3. **Table of contents** (if >3 sections)
4. **Logical sections** with clear headers
5. **Version and date** at bottom

## 🆘 Need Help?

### Documentation Issues
If you find:
- Outdated information
- Broken links
- Unclear explanations
- Missing information

**Create an issue**: Use GitHub Issues with `documentation` label

### Questions Not Covered
If documentation doesn't answer your question:
1. Check all 5 core documents
2. Search for keywords
3. Ask in GitHub Discussions
4. Open an issue for clarification

### Contributing to Docs
See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#pull-request-process) for contribution workflow.

## 🌟 Additional Resources

### External Documentation
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [React Documentation](https://react.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Project Files
- [../README.md](../README.md) - Quick start guide
- [../TESTING.md](../TESTING.md) - Testing suite overview
- [../package.json](../package.json) - Project configuration

### Repository
- **GitHub**: https://github.com/pocc/global-healthchecks
- **Issues**: https://github.com/pocc/global-healthchecks/issues
- **Discussions**: https://github.com/pocc/global-healthchecks/discussions

---

**Documentation Index Version**: 1.1
**Documentation Last Updated**: February 7, 2026
**Total Documentation Pages**: 7
**Total Documentation Words**: ~20,000+
