# Web Automation Recorder - Firefox Extension

A powerful Firefox extension for recording and replaying web interactions with native messaging support.

## Features

- 🔴 **Recording**: Capture clicks, text input, navigation, and more
- ▶️ **Playback**: Execute recorded instructions reliably
- 🔧 **Visual Editor**: Create and modify instructions with ease
- 📦 **Import/Export**: Share instructions as JSON files
- 🔌 **Native Messaging**: Control from external applications
- 🎯 **Smart Selectors**: Multiple strategies for reliable element identification
- ⏱️ **Flexible Waits**: Time-based, element-based, and custom conditions
- 📝 **Variables**: Dynamic values in your automations

## Installation

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from this directory

## Quick Start

### Recording
1. Click the extension icon in the toolbar
2. Click "Start Recording"
3. Navigate to a website and perform your actions
4. Click "Stop Recording" when done
5. Your recording is automatically saved

### Playback
1. Click the extension icon
2. Select a saved instruction from the list
3. Click "Run" to execute it

### Managing Instructions
1. Click "Manage Instructions" in the popup
2. Use the editor to:
   - Modify steps
   - Add variables
   - Test execution
   - Import/export instructions

## Instruction Format

Instructions are stored as JSON with the following structure:

```json
{
  "name": "Example Instruction",
  "url": "https://example.com",
  "steps": [
    {
      "action": "click",
      "selector": { "css": "button.submit" }
    },
    {
      "action": "input_text",
      "selector": { "css": "input#search" },
      "value": "{{searchTerm}}",
      "clear_first": true
    },
    {
      "action": "wait_for_element",
      "selector": { "css": ".results" },
      "timeout": 10000
    }
  ],
  "variables": {
    "searchTerm": {
      "type": "string",
      "default": "web automation"
    }
  }
}
```

## Native Messaging

To use the extension with external applications:

1. Install the native messaging host (see `/native-msg-host/install.bat`)
2. Run the host: `C:\WebAutomation\host.bat`
3. Send commands via TCP to port 9999

Example command:
```json
{
  "action": "run",
  "instruction": "My Instruction",
  "variables": {
    "searchTerm": "firefox extension"
  }
}
```

## Supported Actions

- **click**: Click on elements (supports right-click)
- **input_text**: Type or paste text
- **select_option**: Choose from dropdowns
- **wait_for_element**: Wait for element presence
- **wait_for_time**: Pause for specified duration
- **navigate**: Go to URL
- **get_content**: Extract text or attributes
- **execute_script**: Run custom JavaScript
- **keyboard_shortcut**: Send key combinations

## Tips

1. **Reliable Selectors**: The extension automatically generates multiple selector strategies. Review and edit them in the visual editor for best results.

2. **Smart Recording**: The recorder detects when you pause (>2 seconds) and adds wait steps automatically.

3. **Variables**: Use `{{variableName}}` syntax in any text field to make your instructions dynamic.

4. **Testing**: Use the "Test Steps" button in the editor to verify your instruction works correctly.

5. **Error Handling**: The extension will retry with alternative selectors if the primary one fails.

## Troubleshooting

- **Extension not loading**: Make sure you're using Firefox 78.0 or later
- **Recording not starting**: Check that you have allowed the necessary permissions
- **Native messaging not working**: Ensure the host is running and registered correctly
- **Elements not found**: Use the visual editor to update selectors

## Development

The extension is built with vanilla JavaScript and uses:
- Manifest V2 (Firefox compatibility)
- IndexedDB for storage
- Native Messaging API for external communication

To modify the extension:
1. Edit the source files in the `src/` directory
2. Reload the extension in `about:debugging`
3. Test your changes

## License

This extension is provided as-is for educational and automation purposes.