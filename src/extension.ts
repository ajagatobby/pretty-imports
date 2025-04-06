import * as vscode from "vscode";
import * as ts from "typescript";

let outputChannel: vscode.OutputChannel;
let debounceTimer: NodeJS.Timeout;

/**
 * Gets the configuration for organizing imports.
 * @param document The document to get configuration for
 * @returns The configuration object
 */
function getOrganizeImportsConfig(document: vscode.TextDocument) {
  const config = vscode.workspace.getConfiguration(
    "organizeImports",
    document.uri
  );
  return {
    localPrefixes: config.get<string[]>("localPrefixes", [
      "@/",
      "./",
      "../",
      "~/",
      "#/",
      "*/",
      "src/",
    ]),
    treatRelativeAsLocal: config.get<boolean>("treatRelativeAsLocal", true),
    sortMethod: config.get<string>("sortMethod", "length-desc"),
  };
}

/**
 * Organizes import statements in the given document.
 * @param document The text document to process.
 * @returns A TextEdit object with the organized imports, or undefined if no changes are needed.
 */
function organizeImports(
  document: vscode.TextDocument
): vscode.TextEdit | undefined {
  try {
    const config = getOrganizeImportsConfig(document);
    const { localPrefixes, treatRelativeAsLocal, sortMethod } = config;

    // Parse the document text into a TypeScript source file
    const text = document.getText();
    const sourceFile = ts.createSourceFile(
      document.fileName,
      text,
      ts.ScriptTarget.Latest,
      true
    );

    // Check if sourceFile is valid
    if (!sourceFile) {
      outputChannel.appendLine("Failed to parse source file");
      return undefined;
    }

    // Extract all import declarations at the top of the file
    const imports: ts.ImportDeclaration[] = [];
    let lastImportEnd = 0;
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement)) {
        imports.push(statement);
        lastImportEnd = statement.end;
      } else {
        break; // Stop at the first non-import statement
      }
    }

    // If there are no imports, no changes are needed
    if (imports.length === 0) {
      outputChannel.appendLine("No imports found in the file");
      return undefined;
    }

    outputChannel.appendLine(`Found ${imports.length} imports to organize`);

    // Categorize imports into third-party and local
    const thirdParty: ts.ImportDeclaration[] = [];
    const local: ts.ImportDeclaration[] = [];

    for (const imp of imports) {
      const moduleSpecifier = imp.moduleSpecifier.getText().slice(1, -1); // Remove quotes

      // Check if it's a local import based on prefixes or relative paths
      const isRelativePath =
        moduleSpecifier.startsWith("./") || moduleSpecifier.startsWith("../");
      const matchesPrefix = localPrefixes.some((prefix) =>
        moduleSpecifier.startsWith(prefix)
      );

      if ((treatRelativeAsLocal && isRelativePath) || matchesPrefix) {
        local.push(imp);
        outputChannel.appendLine(`Local import: ${moduleSpecifier}`);
      } else {
        thirdParty.push(imp);
        outputChannel.appendLine(`Third-party import: ${moduleSpecifier}`);
      }
    }

    outputChannel.appendLine(
      `Categorized imports: ${thirdParty.length} third-party, ${local.length} local`
    );

    // Define sorting function based on configuration
    const sortImports = (a: ts.ImportDeclaration, b: ts.ImportDeclaration) => {
      const aModule = a.moduleSpecifier.getText().slice(1, -1);
      const bModule = b.moduleSpecifier.getText().slice(1, -1);

      // Ensure consistent sorting by using explicit return values
      switch (sortMethod) {
        case "alphabetical":
          return aModule.localeCompare(bModule);

        case "length-asc":
          // If lengths are equal, sort alphabetically for consistency
          if (aModule.length === bModule.length) {
            return aModule.localeCompare(bModule);
          }
          return aModule.length - bModule.length;

        case "length-then-alpha":
          const lengthDiff = aModule.length - bModule.length;
          if (lengthDiff !== 0) {
            return lengthDiff;
          }
          return aModule.localeCompare(bModule);

        case "length-desc":
        default:
          // If lengths are equal, sort alphabetically for consistency
          if (aModule.length === bModule.length) {
            return aModule.localeCompare(bModule);
          }
          return bModule.length - aModule.length;
      }
    };

    outputChannel.appendLine("Sorting imports...");
    thirdParty.sort(sortImports);
    local.sort(sortImports);

    // Sort named imports within each import statement alphabetically
    const sortNamedImports = (imp: ts.ImportDeclaration) => {
      if (
        imp.importClause?.namedBindings &&
        ts.isNamedImports(imp.importClause.namedBindings)
      ) {
        const sortedElements = [
          ...imp.importClause.namedBindings.elements,
        ].sort((a, b) => a.name.getText().localeCompare(b.name.getText()));

        const newNamedBindings = ts.factory.updateNamedImports(
          imp.importClause.namedBindings,
          sortedElements
        );

        const newImportClause = ts.factory.updateImportClause(
          imp.importClause,
          imp.importClause.isTypeOnly,
          imp.importClause.name,
          newNamedBindings
        );

        return ts.factory.updateImportDeclaration(
          imp,
          imp.modifiers,
          newImportClause,
          imp.moduleSpecifier,
          imp.assertClause
        );
      }
      return imp;
    };

    const sortedThirdParty = thirdParty.map(sortNamedImports);
    const sortedLocal = local.map(sortNamedImports);

    // Generate the new import text with a blank line between groups
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    let newImportText = sortedThirdParty
      .map((imp) => printer.printNode(ts.EmitHint.Unspecified, imp, sourceFile))
      .join("\n");

    if (sortedLocal.length > 0 && sortedThirdParty.length > 0) {
      newImportText += "\n\n";
    }

    newImportText += sortedLocal
      .map((imp) => printer.printNode(ts.EmitHint.Unspecified, imp, sourceFile))
      .join("\n");

    // Define the range to replace (from start to end of last import)
    const range = new vscode.Range(
      document.positionAt(0),
      document.positionAt(lastImportEnd)
    );

    // Check if the text actually changed
    const currentText = document.getText(range);
    if (currentText === newImportText) {
      outputChannel.appendLine("No changes needed to imports");
      return undefined;
    }

    outputChannel.appendLine("Generated new import text, returning edit");
    return vscode.TextEdit.replace(range, newImportText);
  } catch (error) {
    outputChannel.appendLine(`ERROR in organizeImports: ${error}`);
    return undefined;
  }
}

/**
 * Activates the extension, registering event handlers and commands.
 * @param context The extension context provided by VSCode.
 */
export function activate(context: vscode.ExtensionContext) {
  // Create output channel
  outputChannel = vscode.window.createOutputChannel("Pretty Imports");
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('Extension "pretty-imports" is now active!');

  // Detect potential conflicts
  const extensions = vscode.extensions.all.filter(
    (ext) =>
      ext.id !== "pretty-imports.pretty-imports" &&
      ext.packageJSON.activationEvents &&
      (ext.packageJSON.activationEvents.includes("onLanguage:javascript") ||
        ext.packageJSON.activationEvents.includes("onLanguage:typescript") ||
        ext.packageJSON.activationEvents.some((event: any) =>
          event.includes("onWillSaveTextDocument")
        ))
  );

  outputChannel.appendLine("Potentially conflicting extensions:");
  extensions.forEach((ext) => {
    outputChannel.appendLine(
      `- ${ext.id} (${ext.packageJSON.displayName || "unnamed"})`
    );
  });

  // Register a command to manually organize imports
  const organizeImportsCommand = vscode.commands.registerCommand(
    "organizeImports.organize",
    () => {
      try {
        outputChannel.appendLine("Manual organize imports command triggered");
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const document = editor.document;
          outputChannel.appendLine(`Processing document: ${document.fileName}`);
          const edit = organizeImports(document);
          if (edit) {
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.set(document.uri, [edit]);
            vscode.workspace.applyEdit(workspaceEdit).then((success) => {
              outputChannel.appendLine(`Edit applied: ${success}`);
              if (success) {
                vscode.window.showInformationMessage(
                  "Imports organized successfully"
                );
              } else {
                vscode.window.showErrorMessage("Failed to organize imports");
              }
            });
          } else {
            outputChannel.appendLine("No edits needed");
            vscode.window.showInformationMessage(
              "No changes needed to imports"
            );
          }
        } else {
          outputChannel.appendLine("No active editor");
          vscode.window.showErrorMessage("No active editor");
        }
      } catch (error) {
        outputChannel.appendLine(`ERROR: ${error}`);
        vscode.window.showErrorMessage(`Error organizing imports: ${error}`);
      }
    }
  );

  // Register keyboard shortcut command (Ctrl+Option+F)
  const formatImportsShortcutCommand = vscode.commands.registerCommand(
    "organizeImports.formatShortcut",
    () => {
      try {
        outputChannel.appendLine(
          "Format imports shortcut triggered (Ctrl+Option+F)"
        );
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const document = editor.document;
          outputChannel.appendLine(`Processing document: ${document.fileName}`);
          const edit = organizeImports(document);
          if (edit) {
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.set(document.uri, [edit]);
            vscode.workspace.applyEdit(workspaceEdit).then((success) => {
              outputChannel.appendLine(`Edit applied: ${success}`);
              if (success) {
                vscode.window.showInformationMessage(
                  "Imports organized successfully"
                );
              } else {
                vscode.window.showErrorMessage("Failed to organize imports");
              }
            });
          } else {
            outputChannel.appendLine("No edits needed");
            vscode.window.showInformationMessage(
              "No changes needed to imports"
            );
          }
        } else {
          outputChannel.appendLine("No active editor");
          vscode.window.showErrorMessage("No active editor");
        }
      } catch (error) {
        outputChannel.appendLine(`ERROR: ${error}`);
        vscode.window.showErrorMessage(`Error organizing imports: ${error}`);
      }
    }
  );

  // Register the save event handler with debounce
  const saveHandler = vscode.workspace.onWillSaveTextDocument((event) => {
    try {
      outputChannel.appendLine("Save event triggered");

      // Clear any existing timer
      clearTimeout(debounceTimer);

      // Create a new promise that will resolve after the debounce period
      const debouncedEdit = new Promise<vscode.TextEdit[]>((resolve) => {
        debounceTimer = setTimeout(() => {
          const document = event.document;
          outputChannel.appendLine(`Document language: ${document.languageId}`);

          // Check if the document is a supported language
          const supportedLanguages = [
            "javascript",
            "typescript",
            "javascriptreact",
            "typescriptreact",
            "vue",
          ];

          if (supportedLanguages.includes(document.languageId)) {
            outputChannel.appendLine(
              `Processing ${document.fileName} on save (after 500ms delay)`
            );
            const edit = organizeImports(document);
            if (edit) {
              outputChannel.appendLine("Edits found, applying before save");
              resolve([edit]);
            } else {
              outputChannel.appendLine("No edits needed");
              resolve([]);
            }
          } else {
            outputChannel.appendLine(
              `Skipping unsupported language: ${document.languageId}`
            );
            resolve([]);
          }
        }, 500); // 500ms delay
      });

      // Wait for the debounced edit
      event.waitUntil(debouncedEdit);
    } catch (error) {
      outputChannel.appendLine(`ERROR in save handler: ${error}`);
    }
  });

  // Add a fallback post-save handler
  const postSaveHandler = vscode.workspace.onDidSaveTextDocument((document) => {
    try {
      outputChannel.appendLine("Post-save event triggered");
      // Check if the document is a supported language
      const supportedLanguages = [
        "javascript",
        "typescript",
        "javascriptreact",
        "typescriptreact",
        "vue",
      ];

      if (supportedLanguages.includes(document.languageId)) {
        outputChannel.appendLine(`Processing ${document.fileName} after save`);
        const edit = organizeImports(document);
        if (edit) {
          outputChannel.appendLine("Edits found, applying after save");
          const workspaceEdit = new vscode.WorkspaceEdit();
          workspaceEdit.set(document.uri, [edit]);
          vscode.workspace.applyEdit(workspaceEdit).then((success) => {
            outputChannel.appendLine(`Post-save edit applied: ${success}`);
          });
        }
      }
    } catch (error) {
      outputChannel.appendLine(`ERROR in post-save handler: ${error}`);
    }
  });

  // Add a document formatter provider
  const documentFormatter =
    vscode.languages.registerDocumentFormattingEditProvider(
      [
        { scheme: "file", language: "javascript" },
        { scheme: "file", language: "typescript" },
        { scheme: "file", language: "javascriptreact" },
        { scheme: "file", language: "typescriptreact" },
        { scheme: "file", language: "vue" },
      ],
      {
        provideDocumentFormattingEdits(document) {
          outputChannel.appendLine(
            `Formatting requested for ${document.fileName}`
          );
          const edit = organizeImports(document);
          return edit ? [edit] : [];
        },
      }
    );

  // Add a code action provider
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescriptreact" },
      { scheme: "file", language: "vue" },
    ],
    {
      provideCodeActions(document) {
        const edit = organizeImports(document);
        if (!edit) return [];

        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, [edit]);

        const action = new vscode.CodeAction(
          "Organize Imports",
          vscode.CodeActionKind.Source.append("organizeImports")
        );
        action.edit = workspaceEdit;

        return [action];
      },
    }
  );

  // Create and configure status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(symbol-namespace) Organize Imports";
  statusBarItem.tooltip = "Click to organize imports in the current file";
  statusBarItem.command = "organizeImports.organize";

  // Show the status bar item only when a supported file is active
  function updateStatusBarVisibility(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const supportedLanguages = [
        "javascript",
        "typescript",
        "javascriptreact",
        "typescriptreact",
        "vue",
      ];
      if (supportedLanguages.includes(editor.document.languageId)) {
        statusBarItem.show();
      } else {
        statusBarItem.hide();
      }
    } else {
      statusBarItem.hide();
    }
  }

  // Update visibility when the active editor changes
  const editorChangeSubscription = vscode.window.onDidChangeActiveTextEditor(
    updateStatusBarVisibility
  );
  updateStatusBarVisibility(); // Initial update

  // Add all subscriptions to the context
  context.subscriptions.push(
    organizeImportsCommand,
    formatImportsShortcutCommand,
    saveHandler,
    postSaveHandler,
    documentFormatter,
    codeActionProvider,
    statusBarItem,
    editorChangeSubscription
  );
}

/**
 * Deactivates the extension.
 */
export function deactivate() {
  // Clean up any resources
  clearTimeout(debounceTimer);
  outputChannel.appendLine('Extension "pretty-imports" is now deactivated');
}
