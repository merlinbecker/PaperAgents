# Paper Agents - Manual Testing Guide

**Phase 4: Testing Checklist**  
**Date:** January 11, 2026  
**Updated:** January 12, 2026

---

## Status Update (January 12, 2026)

✅ **Automated Tests:** 38 Tests erfolgreich (Unit, Integration, E2E) - 66% Coverage  
⏳ **Manual Tests:** Wird NACH Feature-Completeness durchgeführt  
✅ **Build:** Erfolgreich - Plugin kompilierbar  

## ⚠️ WICHTIG: Timing dieses Guides

**Dieser manuelle UI-Test wird NICHT sofort durchgeführt!**

**Entwicklungsstrategie:**
1. ✅ Phase 1: Build & Test-Suite (ERLEDIGT)
2. ⏳ Phase 2: Feature-Runde 1 - Pre/Post-Processing (1-2 Tage)
3. ⏳ Phase 3: Feature-Runde 2 - QuickJS-Sandbox (1-2 Tage)
4. 🎯 **Phase 4: DANN dieser manuelle UI-Test (0.5-1 Tag)**

**Warum diese Reihenfolge?**
- Alle Features werden erst via **Unit Tests** abgesichert
- Kern-Logik ist validiert, bevor UI getestet wird
- Finaler UI-Test fokussiert auf **UI-spezifische Bugs**
- Schnellere Bug-Lokalisierung durch klare Trennung

**Was getestet wird wenn dieser Guide zum Einsatz kommt:**
- ✅ Pre/Post-Processing (durch Unit Tests bereits validiert)
- ✅ QuickJS-Sandbox (durch Security-Tests bereits validiert)
- ⏳ UI-Integration all dieser Features in echtem Obsidian
- ⏳ End-to-End Workflows in echter Vault-Umgebung

---

## Prerequisites

1. Obsidian installed (v0.15.0+)
2. Plugin built: `npm run build` ✅ (erfolgreich)
3. Plugin files in Vault: `.obsidian/plugins/paper-agents/`
   - `main.js` ✅ (generiert)
   - `manifest.json` ✅ (vorhanden)
   - `styles.css` ✅ (vorhanden)
4. Plugin enabled in Settings → Community plugins
5. **⚠️ Pre/Post-Processing implementiert und getestet**
6. **⚠️ QuickJS-Sandbox implementiert und getestet**

---

## Test Suite

### 1. Plugin Initialization ✓

**Test 1.1: Plugin Loads**
- [ ] Open Obsidian
- [ ] Check console: "Paper Agents plugin loaded successfully"
- [ ] No errors in Developer Tools (Ctrl+Shift+I)

**Test 1.2: Ribbon Icon Appears**
- [ ] Bot icon (🤖) visible in left ribbon
- [ ] Tooltip shows "Paper Agents"

**Test 1.3: Settings Tab**
- [ ] Open Settings → Community plugins → Paper Agents
- [ ] Settings tab opens
- [ ] Shows: "Custom Tools Path" and "Enable Debug Logging"

---

### 2. Sidebar Functionality ✓

**Test 2.1: Open Sidebar**
- [ ] Click ribbon icon → Sidebar opens in right panel
- [ ] Alternative: Command Palette → "Open Paper Agents Sidebar"
- [ ] Sidebar shows "Paper Agents" title

**Test 2.2: Tool Display**
- [ ] Section "Predefined Tools" visible
- [ ] 4 tools shown:
  - 🔧 search_files
  - 🔧 read_file
  - 🔧 write_file
  - 🔧 rest_request
- [ ] Each tool shows parameter count badge

**Test 2.3: Refresh**
- [ ] Click Refresh button (↻)
- [ ] Tools reload without errors
- [ ] Console: "Tools refreshed"

**Test 2.4: Status Updates**
- [ ] Bottom status shows "Ready"
- [ ] Status changes after tool execution

---

### 3. Tool Forms ✓

**Test 3.1: Open Form (search_files)**
- [ ] Click on "search_files" tool
- [ ] Modal opens with title "search_files"
- [ ] Shows 2 parameters:
  - query (string, required)
  - path (string, optional, default: "/")

**Test 3.2: Parameter Input**
- [ ] Enter query: "test"
- [ ] Leave path empty (uses default)
- [ ] Both Cancel and Execute buttons visible

**Test 3.3: Form Validation**
- [ ] Clear query field (required parameter)
- [ ] Click Execute
- [ ] Error message appears: "Required parameter missing: query"
- [ ] Error auto-removes after 5 seconds

**Test 3.4: Cancel**
- [ ] Click Cancel
- [ ] Modal closes
- [ ] No execution happens

---

### 4. Tool Execution (No HITL) ✓

**Test 4.1: search_files**
- [ ] Open search_files form
- [ ] Enter query: "readme"
- [ ] Click Execute
- [ ] Modal closes
- [ ] Status shows: "Executing search_files..."
- [ ] Success notice: "✅ search_files completed successfully"
- [ ] Status shows: "✅ search_files completed" (auto-clear after 3s)
- [ ] Console shows results array

**Test 4.2: read_file**
- [ ] Create test file: `test.md` in vault
- [ ] Open read_file form
- [ ] Enter filePath: "test.md"
- [ ] Click Execute
- [ ] Success notice appears
- [ ] Console shows file content

**Test 4.3: read_file (File Not Found)**
- [ ] Open read_file form
- [ ] Enter filePath: "nonexistent.md"
- [ ] Click Execute
- [ ] Error notice: "❌ read_file failed: File not found"
- [ ] Status shows error (auto-clear after 5s)

---

### 5. HITL Modal ✓

**Test 5.1: write_file Opens HITL**
- [ ] Open write_file form
- [ ] Enter filePath: "output.md"
- [ ] Enter content: "Test content"
- [ ] Set overwrite: false
- [ ] Click Execute
- [ ] Form closes
- [ ] **HITL Modal opens** (⚠️ Approval Required)

**Test 5.2: HITL Modal Content**
- [ ] Modal shows:
  - Icon: ⚠️
  - Title: "Approval Required"
  - Tool: write_file
  - Step: (not applicable for single execution)
- [ ] Parameters preview shows:
  - filePath: "output.md"
  - content: "Test content"
  - overwrite: false
- [ ] Warning box appears:
  - "⚠️ Warning"
  - "This operation will modify files in your vault..."

**Test 5.3: HITL Reject**
- [ ] Click "❌ Reject" (or press Escape)
- [ ] Modal closes
- [ ] Error notice: "❌ write_file failed: User rejected..."
- [ ] File NOT created
- [ ] Console: "HITL rejected"

**Test 5.4: HITL Approve**
- [ ] Open write_file form again
- [ ] Enter same parameters
- [ ] Click Execute
- [ ] HITL Modal opens
- [ ] Click "✅ Approve" (or press Enter)
- [ ] Modal closes
- [ ] Success notice appears
- [ ] File created: `output.md`
- [ ] Console: "HITL approved"

**Test 5.5: Keyboard Shortcuts**
- [ ] Open write_file → HITL Modal
- [ ] Press Enter → Approves
- [ ] Open again
- [ ] Press Escape → Rejects

---

### 6. REST Request Tool ✓

**Test 6.1: GET Request (No HITL)**
- [ ] Open rest_request form
- [ ] Enter url: "https://api.github.com/users/octocat"
- [ ] Enter method: "GET"
- [ ] Click Execute
- [ ] NO HITL Modal (GET is safe)
- [ ] Success notice
- [ ] Console shows response body

**Test 6.2: POST Request (With HITL)**
- [ ] Open rest_request form
- [ ] Enter url: "https://httpbin.org/post"
- [ ] Enter method: "POST"
- [ ] Enter body: '{"test": "data"}'
- [ ] Click Execute
- [ ] **HITL Modal opens** (POST requires approval)
- [ ] Warning: "This operation will send a request that may modify external data"
- [ ] Approve → Request sent
- [ ] Success notice

---

### 7. Custom Tools Loading ✓

**Test 7.1: No Custom Tools Folder**
- [ ] Ensure "paper-agents-tools" folder doesn't exist
- [ ] Reload plugin
- [ ] Console: "No tool files found in paper-agents-tools"
- [ ] Only Predefined Tools visible

**Test 7.2: Create Custom Tool**
- [ ] Create folder: `paper-agents-tools/`
- [ ] Create file: `paper-agents-tools/example-tool.md`
- [ ] Add content:
```markdown
---
tool: true
name: "Example Tool"
description: "Test custom tool"
type: single
parameters:
  - name: input
    type: string
    required: true
---

# Example Tool
This is a test.
```
- [ ] Run command: "Reload Custom Tools"
- [ ] Notice: "Loaded 1 tools, 0 failed"
- [ ] Sidebar refreshes
- [ ] Section "Custom Tools" appears
- [ ] "Example Tool" visible

**Test 7.3: Invalid Custom Tool**
- [ ] Create `paper-agents-tools/invalid.md` with broken YAML
- [ ] Reload Custom Tools
- [ ] Notice shows failures
- [ ] Console shows parsing errors

---

### 8. Settings ✓

**Test 8.1: Change Custom Tools Path**
- [ ] Open Settings → Paper Agents
- [ ] Change "Custom Tools Path" to "my-tools"
- [ ] Create folder `my-tools/`
- [ ] Move custom tool there
- [ ] Reload Custom Tools
- [ ] Tool loaded from new path

**Test 8.2: Debug Logging**
- [ ] Enable "Enable Debug Logging"
- [ ] Execute any tool
- [ ] Console shows detailed debug logs
- [ ] Disable → Debug logs stop

---

### 9. Error Handling ✓

**Test 9.1: Network Error**
- [ ] Open rest_request
- [ ] Enter invalid URL: "http://invalid-domain-12345.com"
- [ ] Execute (approve HITL if needed)
- [ ] Error notice with network error
- [ ] No crash

**Test 9.2: Invalid Parameter Type**
- [ ] Open tool form
- [ ] Enter text in number field
- [ ] Validation shows error

**Test 9.3: Plugin Reload**
- [ ] Disable plugin
- [ ] Re-enable plugin
- [ ] Everything works again
- [ ] No memory leaks
- [ ] Sidebar can be reopened

---

### 10. Mobile Testing (Optional) ✓

**If testing on mobile device:**

**Test 10.1: Sidebar on Mobile**
- [ ] Sidebar opens in bottom sheet or side panel
- [ ] Tools clickable
- [ ] Forms usable

**Test 10.2: HITL on Mobile**
- [ ] Modal readable
- [ ] Buttons stack vertically
- [ ] Touch targets large enough

**Test 10.3: Performance**
- [ ] No lag when opening sidebar
- [ ] Smooth animations
- [ ] No memory issues

---

## Edge Cases ✓

**Test E1: Very Long Tool Name**
- [ ] Create tool with 100+ character name
- [ ] Displays correctly (truncated if needed)

**Test E2: Special Characters in Parameters**
- [ ] Use emojis, unicode in parameters
- [ ] No crashes

**Test E3: Rapid Clicking**
- [ ] Click tool multiple times rapidly
- [ ] Only one form opens
- [ ] No duplicate executions

**Test E4: Large Output**
- [ ] read_file on large file (10MB+)
- [ ] Handles gracefully or shows error

---

## Performance Benchmarks ✓

| Operation | Expected Time | Actual |
|-----------|---------------|--------|
| Plugin Load | <500ms | |
| Sidebar Open | <100ms | |
| Form Open | <50ms | |
| search_files (100 files) | <200ms | |
| read_file | <50ms | |
| HITL Modal Open | <50ms | |

---

## Known Issues to Document

**Issue 1: [Description]**
- Steps to reproduce:
- Expected behavior:
- Actual behavior:
- Workaround:

---

## Sign-Off

**Tested by:** _____________  
**Date:** _____________  
**Build Version:** _____________  
**Pass/Fail:** _____________

**Notes:**
