# Web Automation Assistant

A Firefox browser extension for recording and replaying web interactions with native messaging support. Record your actions on any webpage and replay them programmatically through a PowerShell-based native messaging host.

## Features

- 🎬 **Record & Replay**: Record clicks, typing, and other interactions on any webpage
- 📝 **Visual Script Editor**: Edit recorded scripts with drag-and-drop reordering
- 🔄 **Smart Element Selection**: Multiple fallback strategies for reliable element identification
- ⏱️ **Flexible Wait Conditions**: Time-based, element presence, text content, and custom JavaScript conditions
- 🔌 **Native Messaging**: Control the extension from external applications via TCP
- 💾 **Script Management**: Save, organize, and export your automation scripts
- 🎯 **Variable Support**: Use variables in your scripts for dynamic content

## Installation

### Firefox Extension

1. Clone the repository:
   ```bash
   git clone https://github.com/Sean-Khorasani/Web-Automation-Assistant.git
   cd Web-Automation-Assistant
   ```

2. Load the extension in Firefox:
   - Open Firefox and navigate to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file from the `firefox-extension` directory

### Native Messaging Host (Windows)

1. Navigate to the native messaging host directory:
   ```bash
   cd native-msg-host
   ```

2. Run the installation script as Administrator:
   ```batch
   install.bat
   ```

This will:
- Copy necessary files to `C:\WebAutomation\`
- Register the native messaging host with Firefox
- Create desktop shortcuts for the host and test client

## Usage

### Recording Scripts

1. Click the extension icon in the Firefox toolbar
2. Click "Start Recording"
3. Perform your actions on the webpage
4. Click "Stop Recording" when done
5. Save the script with a meaningful name

### Running Scripts

#### From the Extension
1. Click the extension icon
2. Select a saved script from the "Recent Scripts" list
3. Click "Run"

#### From External Applications
Start the native messaging host:
```batch
C:\WebAutomation\host.bat
```

Then connect via TCP on port 9999:
```python
import socket
import json

def run_automation(instruction_name, variables={}):
    s = socket.socket()
    s.connect(('localhost', 9999))
    
    request = {
        'action': 'run',
        'instruction': instruction_name,
        'variables': variables
    }
    
    s.send(json.dumps(request).encode() + b'\n')
    response = json.loads(s.recv(4096).decode())
    s.close()
    
    return response

# Example usage
result = run_automation('Search Google', {'query': 'Firefox extensions'})
print(result)
```

## Script Format

Scripts are stored as JSON with a simple, readable structure:

```json
{
  "name": "Example Script",
  "url": "https://example.com",
  "steps": [
    {
      "action": "wait",
      "for": "element",
      "selector": "input[name='search']",
      "timeout": 5000
    },
    {
      "action": "click",
      "selector": "input[name='search']"
    },
    {
      "action": "type",
      "selector": "input[name='search']",
      "text": "{SEARCH_TERM}",
      "clear": true
    },
    {
      "action": "click",
      "selector": "button[type='submit']"
    }
  ]
}
```

## Supported Actions

- **click**: Click on an element
- **type**: Type text into an input field
- **wait**: Wait for various conditions
- **navigate**: Navigate to a URL
- **select**: Select an option from a dropdown
- **get_content**: Extract content from the page
- **execute_script**: Run custom JavaScript

## Development

### Project Structure
```
Web-Automation-Assistant/
├── firefox-extension/       # Browser extension files
│   ├── manifest.json
│   ├── src/
│   │   ├── background/     # Background scripts
│   │   ├── content/        # Content scripts
│   │   ├── popup/          # Popup UI
│   │   └── options/        # Options page
│   └── icons/              # Extension icons
├── native-msg-host/        # Native messaging host (PowerShell)
│   ├── host.ps1           # Main host script
│   ├── install.bat        # Installation script
│   └── test-client.ps1    # Test client
└── docs/                  # Documentation
```

### Building from Source

No build process required! The extension uses vanilla JavaScript and can be loaded directly into Firefox.

## Troubleshooting

### Extension Not Loading
- Ensure you're using Firefox 78.0 or later
- Check the browser console for error messages
- Verify all files are present in the firefox-extension directory

### Recording Not Working
- Refresh the page before starting recording
- Check if the page has restrictive Content Security Policy
- Enable debug logging in the extension options

### Native Messaging Issues
- Ensure the host is installed correctly
- Check `C:\WebAutomation\host.log` for errors
- Verify Windows PowerShell execution policy allows running scripts

## Security Considerations

- Scripts have full access to page content
- Only run scripts from trusted sources
- The native messaging host only accepts connections from localhost
- Consider the security implications of automated web interactions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built for Firefox using the WebExtensions API
- Native messaging implemented in PowerShell for Windows compatibility
- Designed for ease of use and reliability