### Pretty Imports

**Pretty Imports** automatically organizes your JavaScript and TypeScript import statements when you save a file. It separates third-party and local imports, sorts them according to your preferences, and keeps your code clean and consistent.

## Features

- **Automatic Organization**: Imports are automatically organized when you save a file
- **Import Separation**: Clearly separates third-party libraries from your local imports
- **Flexible Sorting**: Sort imports by length, alphabetically, or a combination of both
- **Named Import Sorting**: Alphabetically sorts named imports within each import statement
- **Customizable**: Extensive configuration options to match your project's style
- **Keyboard Shortcut**: Use Ctrl+Alt+F to quickly organize imports
- **Status Bar Integration**: One-click access from the status bar

## Installation

1. Open VS Code
2. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the Quick Open dialog
3. Type `ext install pretty-imports` and press Enter
4. Restart VS Code when prompted

## Usage

Pretty Imports works automatically when you save a file. No additional steps required!

### Manual Organization

You can organize imports in several ways:

1. **Keyboard Shortcut**: Press `Ctrl+Alt+F` (or `Cmd+Alt+F` on macOS)
2. **Command Palette**: Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS), type "Organize Imports" and select the command
3. **Status Bar**: Click the "$(symbol-namespace) Organize Imports" button in the status bar
4. **Format Document**: Use the standard VS Code format document command (`Shift+Alt+F`)

## Before and After

### Before

```typescript
import { z } from "zod";
import { Button } from "@/components/ui/button";
import React from "react";
import { createContext, useContext, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
```

### After

```typescript
import { createContext, useContext, useState } from "react";
import React from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
```

## Configuration

Pretty Imports can be customized through VS Code settings. Access them by going to File > Preferences > Settings and searching for "Organize Imports".

### Available Settings

#### `organizeImports.localPrefixes`

An array of prefixes that identify local imports.

- **Type**: Array of strings
- **Default**: `["@/", "./", "../", "~/", "#/", "*/", "src/"]`
- **Example**:

```json
"organizeImports.localPrefixes": ["@/", "~/", "app/"]
```

#### `organizeImports.treatRelativeAsLocal`

Whether to treat relative imports (starting with `./` or `../`) as local imports.

- **Type**: Boolean
- **Default**: `true`
- **Example**:

```json
"organizeImports.treatRelativeAsLocal": false
```

#### `organizeImports.sortMethod`

Method to sort imports.

- **Type**: String
- **Options**:

- `"alphabetical"`: Sort imports alphabetically
- `"length-asc"`: Sort imports by length, shortest first
- `"length-desc"`: Sort imports by length, longest first (default)
- `"length-then-alpha"`: Sort imports by length, then alphabetically

- **Default**: `"length-desc"`
- **Example**:

```json
"organizeImports.sortMethod": "alphabetical"
```

### Example Configuration

```json
{
  "organizeImports.localPrefixes": ["@/", "~/", "src/"],
  "organizeImports.treatRelativeAsLocal": true,
  "organizeImports.sortMethod": "length-desc"
}
```

## Supported Languages

- JavaScript (`.js`)
- TypeScript (`.ts`)
- JSX (`.jsx`)
- TSX (`.tsx`)
- Vue (`.vue`)

## Workspace-Specific Settings

You can have different settings for different projects by adding them to your workspace settings:

1. Open your project
2. Go to File > Preferences > Settings
3. Switch to "Workspace" tab
4. Search for "Organize Imports"
5. Modify settings for this workspace only

Or add to your `.vscode/settings.json` in your project:

```json
{
  "organizeImports.localPrefixes": ["src/", "lib/"],
  "organizeImports.sortMethod": "length-asc"
}
```

## Troubleshooting

### Extension Not Working

1. **Check Output Panel**: Open the Output panel (View > Output) and select "pretty-imports" from the dropdown to see detailed logs
2. **Reload Window**: Try reloading the VS Code window (Developer: Reload Window from the command palette)
3. **Check File Type**: Make sure you're editing a supported file type (JS, TS, JSX, TSX, Vue)
4. **Check Settings**: Verify your settings aren't conflicting with other extensions

### Common Issues

#### Imports Not Organizing

- Check if the file has syntax errors
- Verify the file language is supported
- Try running the command manually from the command palette

#### Wrong Sorting Order

- Check your `organizeImports.sortMethod` setting
- Make sure you've reloaded VS Code after changing settings

## How It Works

Pretty Imports uses TypeScript's compiler API to:

1. Parse your code into an Abstract Syntax Tree (AST)
2. Identify and extract all import declarations
3. Categorize them as third-party or local based on your settings
4. Sort them according to your preferred method
5. Sort named imports within each import statement
6. Generate new, organized import statements
7. Replace the original imports with the organized ones

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by the need for consistent import organization in large codebases
- Built with TypeScript and the VS Code Extension API
- Uses the TypeScript Compiler API for accurate code parsing

---

**Enjoy organizing your imports with Pretty Imports!** 🚀

## Release Notes

### 0.0.1

- Initial release
- Support for JavaScript, TypeScript, JSX, TSX, and Vue files
- Automatic import organization on save
- Customizable sorting methods
- Separation of third-party and local imports
