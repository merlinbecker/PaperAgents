# 📚 Documentation Guide - Paper Agents

**Quick navigation guide for all project documentation**

---

## 🎯 Where to Start?

### For Users
👉 **[README.md](README.md)** - Start here!
- Project overview and vision
- Feature list (what works now, what's planned)
- Installation instructions
- Quick start guide
- Examples of usage

### For Developers
👉 **[DEVELOPMENT.md](DEVELOPMENT.md)** - Developer handbook
- Setup instructions
- Project structure
- Code conventions
- Testing strategy
- Contributing guidelines

### For Project Management
👉 **[PROJEKT_STATUS.md](PROJEKT_STATUS.md)** - Current status & roadmap
- Requirements vs. implementation comparison
- What's done, what's missing
- Detailed roadmap for next phases
- Timeline and risk assessment

---

## 📋 Documentation Map

```
┌─────────────────────────────────────────────────────────┐
│                     README.md                            │
│         (Single Source of Truth - START HERE)           │
│  • Project overview      • Installation                 │
│  • Features             • Quick start                   │
│  • Architecture         • Roadmap                       │
└─────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│ PROJEKT_STATUS  │ │ DEVELOPMENT  │ │   manuals/      │
│      .md        │ │     .md      │ │   tools.md      │
├─────────────────┤ ├──────────────┤ ├─────────────────┤
│ • Requirements  │ │ • Setup      │ │ • Tool notation │
│ • Implementation│ │ • Structure  │ │ • YAML format   │
│ • Comparison    │ │ • Conventions│ │ • Parameters    │
│ • Next phases   │ │ • Testing    │ │ • Placeholders  │
│ • Timeline      │ │ • Contributing│ │ • Examples     │
└─────────────────┘ └──────────────┘ └─────────────────┘
         │
         └────────────────┬────────────────┐
                          │                │
                          ▼                ▼
                  ┌──────────────┐ ┌──────────────┐
                  │   examples/  │ │   Reports/   │
                  │   README.md  │ │PhaseWerkzeuge│
                  ├──────────────┤ ├──────────────┤
                  │ • 4 example  │ │ • Phase 1-3  │
                  │   tools      │ │   details    │
                  │ • Best       │ │ • Test       │
                  │   practices  │ │   coverage   │
                  └──────────────┘ └──────────────┘
```

---

## 📄 File Descriptions

### Core Documentation

| File | Purpose | Audience | Size |
|------|---------|----------|------|
| **README.md** | Main entry point, project overview | Everyone | 15 KB |
| **PROJEKT_STATUS.md** | Status analysis, roadmap, next steps | PM, Developers | 15 KB |
| **DEVELOPMENT.md** | Developer handbook | Developers | 11 KB |
| **AGENTS.md** | Guidelines for AI agents | AI/Bots | 11 KB |
| **RELEASE.md** | Release process | Maintainers | 4 KB |

### Specialized Documentation

| File | Purpose | Audience |
|------|---------|----------|
| **manuals/tools.md** | Tool notation reference | Tool creators |
| **examples/README.md** | Example tools overview | Users, Developers |
| **Reports/PhaseWerkzeuge.md** | Phase 1-3 detailed report | Developers, PM |

---

## 🔍 Find Information By Topic

### Installation & Setup
- **Users**: [README.md](README.md) → Installation section
- **Developers**: [DEVELOPMENT.md](DEVELOPMENT.md) → Setup section

### Features & Capabilities
- **Current features**: [README.md](README.md) → Features section
- **Planned features**: [PROJEKT_STATUS.md](PROJEKT_STATUS.md) → Phase 4-5

### Creating Tools
- **Quick start**: [README.md](README.md) → Custom Tools section
- **Detailed reference**: [manuals/tools.md](manuals/tools.md)
- **Examples**: [examples/](examples/)

### Development
- **Getting started**: [DEVELOPMENT.md](DEVELOPMENT.md) → Quick Start
- **Architecture**: [README.md](README.md) → Architecture section
- **Testing**: [DEVELOPMENT.md](DEVELOPMENT.md) → Testing Strategy

### Project Status
- **What's done**: [PROJEKT_STATUS.md](PROJEKT_STATUS.md) → Section 2
- **What's next**: [PROJEKT_STATUS.md](PROJEKT_STATUS.md) → Section 4
- **Timeline**: [PROJEKT_STATUS.md](PROJEKT_STATUS.md) → Section 5

### Contributing
- **Guidelines**: [DEVELOPMENT.md](DEVELOPMENT.md) → Contributing section
- **Code style**: [DEVELOPMENT.md](DEVELOPMENT.md) → Code Style section

---

## 🎓 Reading Order

### For New Users
1. [README.md](README.md) - Understand what Paper Agents is
2. [examples/README.md](examples/README.md) - See what's possible
3. [manuals/tools.md](manuals/tools.md) - Learn tool notation

### For New Developers
1. [README.md](README.md) - Project overview
2. [DEVELOPMENT.md](DEVELOPMENT.md) - Setup and conventions
3. [PROJEKT_STATUS.md](PROJEKT_STATUS.md) - Current status
4. [Reports/PhaseWerkzeuge.md](Reports/PhaseWerkzeuge.md) - Implementation details

### For Project Managers
1. [README.md](README.md) - High-level overview
2. [PROJEKT_STATUS.md](PROJEKT_STATUS.md) - Detailed analysis and roadmap
3. [Reports/PhaseWerkzeuge.md](Reports/PhaseWerkzeuge.md) - Phase 1-3 report

---

## 🔄 Documentation Maintenance

### When to Update Which File

**After implementing a feature:**
- Update [README.md](README.md) (move from "Planned" to "Implemented")
- Update [PROJEKT_STATUS.md](PROJEKT_STATUS.md) (mark phase/task as complete)

**When planning new features:**
- Update [PROJEKT_STATUS.md](PROJEKT_STATUS.md) (add to roadmap)
- Add high-level description to [README.md](README.md) (if user-facing)

**When changing architecture:**
- Update [README.md](README.md) (Architecture section)
- Update [DEVELOPMENT.md](DEVELOPMENT.md) (Architecture patterns)

**After a release:**
- Update [README.md](README.md) (version badge, features)
- Create entry in [RELEASE.md](RELEASE.md) changelog

---

## 📞 Quick Reference

| I want to... | Go to... |
|--------------|----------|
| Understand the project | [README.md](README.md) |
| Install the plugin | [README.md](README.md) → Installation |
| Create a custom tool | [manuals/tools.md](manuals/tools.md) |
| See examples | [examples/](examples/) |
| Start developing | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Know what's next | [PROJEKT_STATUS.md](PROJEKT_STATUS.md) |
| Understand current status | [PROJEKT_STATUS.md](PROJEKT_STATUS.md) |
| Check test coverage | [Reports/PhaseWerkzeuge.md](Reports/PhaseWerkzeuge.md) |
| Release a version | [RELEASE.md](RELEASE.md) |
| Contribute code | [DEVELOPMENT.md](DEVELOPMENT.md) → Contributing |

---

## 🎯 Documentation Principles

1. **Single Source of Truth**: README.md is the main entry point
2. **Cross-referenced**: All docs link to each other
3. **Audience-specific**: Different docs for different readers
4. **Up-to-date**: Updated with each significant change
5. **Bilingual**: German for user-facing, English/German mix for technical

---

*This guide was created on January 29, 2026 as part of the documentation consolidation effort.*
