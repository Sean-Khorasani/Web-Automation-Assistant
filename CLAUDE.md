# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Firefox browser extension project for recording and replaying web interactions with native messaging support. The extension communicates with external applications through a PowerShell-based native messaging host that runs a TCP server on port 9999.

## Commands and Development Tasks

### Running the Native Host
```bash
# Windows (PowerShell)
powershell -NoProfile -ExecutionPolicy Bypass -File native-msg-host/host.ps1

# Or use the batch wrapper
native-msg-host/host.bat
```

### Testing the Native Host
```bash
# Interactive test client
powershell -NoProfile -ExecutionPolicy Bypass -File native-msg-host/test-client.ps1

# Simple command line test
native-msg-host/test-simple.bat "Your test prompt here"
```

### Installation (Windows)
```bash
# Run as administrator
native-msg-host/install.bat
```

## Architecture

### Project Structure
- **firefox-extension/** - Browser extension files
  - Contains: manifest.json, background.js, content.js, popup.html/js/css and all other extension components
- **native-msg-host/** - Native messaging host implementation (PowerShell)
  - Contains the TCP server that bridges between the extension and external applications
- **test-client-win/** - Windows test client directory (empty)

### Key Architectural Decisions

1. **Windows-Only Implementation**: Uses PowerShell and batch scripts exclusively, avoiding external dependencies like Node.js or Python.

2. **Communication Flow**:
   - External apps → TCP (port 9999) → Native Host → Native Messaging → Extension → Web Page
   - Responses flow back through the same chain

3. **Native Messaging Protocol**: 
   - Uses stdin/stdout with 4-byte length prefix followed by JSON message
   - Concurrent message handling with queue-based architecture

4. **Missing Core Components**:
   - The actual browser extension JavaScript is not implemented yet
   - Key files needed: background.js (message handling), content.js (page interaction), popup.js (UI)

## Implementation Notes

### Element Selection Strategy
The extension should use multiple fallback strategies for reliable element identification:
1. Unique IDs (highest priority)
2. CSS selectors with specificity optimization
3. XPath expressions
4. Text content matching
5. ARIA labels and roles
6. Custom data attributes

### Recording Features to Implement
- Capture clicks, text input, keyboard shortcuts, navigation
- Detect user waits (>2 seconds between actions)
- Ignore unnecessary events (mouse movements, hovers)
- Combine rapid typing into single "type" actions

### Instruction Format
Instructions are stored as JSON with this structure:
```json
{
  "name": "Instruction Name",
  "url": "https://example.com",
  "steps": [
    {
      "action": "click|type|wait|return",
      "selector": "CSS selector or element identifier",
      "value": "for type actions",
      "timeout": "for wait actions"
    }
  ]
}
```

### Wait Strategies
Support multiple wait conditions:
- Time-based delays
- Element appearance/disappearance
- Text content changes
- Custom JavaScript conditions
- Network idle state

## Current Status

The Firefox extension is now fully implemented with all core features:

### Completed Components
1. **Extension Structure**: Complete file organization with manifest.json configured for Firefox
2. **Background Scripts**: 
   - Main background.js with recording/playback coordination
   - StorageManager with IndexedDB for instruction persistence
   - NativeMessaging handler for external communication
   - InstructionExecutor for playback engine
3. **Content Scripts**:
   - Main content.js for page interaction
   - Recorder module for capturing user actions
   - ElementSelector with multi-strategy element identification
   - ActionPerformer for executing recorded actions
4. **User Interface**:
   - Popup interface for quick access to recording controls
   - Options page with full instruction management
   - Visual editor for creating and modifying instructions
5. **Core Features**:
   - Recording with smart event capture and pause detection
   - Playback with error handling and retry logic
   - Variable support throughout the system
   - Import/export functionality
   - Multiple wait strategies

### Testing the Extension
1. Load the extension in Firefox:
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the manifest.json file from the extension directory

2. Test recording:
   - Click the extension icon in the toolbar
   - Click "Start Recording"
   - Navigate to a website and perform actions
   - Click "Stop Recording" when done

3. Test playback:
   - Open the options page (Manage Instructions)
   - Find your recorded instruction
   - Click "Run" to execute it

### Known Limitations
- Icons are placeholder files (1x1 pixel PNGs)
- Native messaging requires the PowerShell host to be running
- Some advanced features may need additional testing

### Next Steps for Enhancement
1. Replace placeholder icons with proper graphics
2. Add more comprehensive error messages
3. Implement additional wait strategies
4. Add instruction templates
5. Enhance the visual selector builder
6. Add performance optimizations