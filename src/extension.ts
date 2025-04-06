import * as vscode from "vscode";
import * as ts from "typescript";

/**
 * Activates the extension, registering the onWillSaveTextDocument event handler
 * and a command to manually organize imports.
 * @param context The extension context provided by VSCode.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "pretty-imports" is now active!');

  // Register a command to manually organize imports
  const organizeImportsCommand = vscode.commands.registerCommand(
    "organizeImports.organize",
    () => {
      console.log("Manual organize imports command triggered");
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        console.log(`Processing document: ${document.fileName}`);
        const edit = organizeImports(document);
        if (edit) {
          const workspaceEdit = new vscode.WorkspaceEdit();
          workspaceEdit.set(document.uri, [edit]);
          vscode.workspace.applyEdit(workspaceEdit).then((success) => {
            console.log(`Edit applied: ${success}`);
          });
        } else {
          console.log("No edits needed");
        }
      } else {
        console.log("No active editor");
      }
    }
  );

  // Register the save event handler
  const saveHandler = vscode.workspace.onWillSaveTextDocument((event) => {
    console.log("Save event triggered");
    const document = event.document;
    console.log(`Document language: ${document.languageId}`);

    // Check if the document is a supported language
    const supportedLanguages = [
      "javascript",
      "typescript",
      "javascriptreact",
      "typescriptreact",
      "vue",
    ];

    if (supportedLanguages.includes(document.languageId)) {
      console.log(`Processing ${document.fileName} on save`);
      const edit = organizeImports(document);
      if (edit) {
        console.log("Edits found, applying before save");
        // Provide the edit to be applied before saving
        event.waitUntil(Promise.resolve([edit]));
      } else {
        console.log("No edits needed");
      }
    } else {
      console.log(`Skipping unsupported language: ${document.languageId}`);
    }
  });

  // Add both subscriptions to the context
  context.subscriptions.push(organizeImportsCommand, saveHandler);
}

/**
 * Organizes import statements in the given document.
 * @param document The text document to process.
 * @returns A TextEdit object with the organized imports, or undefined if no changes are needed.
 */
function organizeImports(
  document: vscode.TextDocument
): vscode.TextEdit | undefined {
  // Get configuration
  const config = vscode.workspace.getConfiguration("organizeImports");
  const localPrefixes = config.get<string[]>("localPrefixes", [
    "@/",
    "./",
    "../",
    "~/",
    "#/",
    "*/",
    "src/",
  ]);
  const treatRelativeAsLocal = config.get<boolean>(
    "treatRelativeAsLocal",
    true
  );
  const sortMethod = config.get<string>("sortMethod", "length-desc");

  // Debug logging
  console.log("Configuration loaded:");
  console.log("- localPrefixes:", localPrefixes);
  console.log("- treatRelativeAsLocal:", treatRelativeAsLocal);
  console.log("- sortMethod:", sortMethod);

  // Parse the document text into a TypeScript source file
  const text = document.getText();
  const sourceFile = ts.createSourceFile(
    document.fileName,
    text,
    ts.ScriptTarget.Latest,
    true
  );

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
    console.log("No imports found in the file");
    return undefined;
  }

  console.log(`Found ${imports.length} imports to organize`);

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
      console.log(`Local import: ${moduleSpecifier}`);
    } else {
      thirdParty.push(imp);
      console.log(`Third-party import: ${moduleSpecifier}`);
    }
  }

  console.log(
    `Categorized imports: ${thirdParty.length} third-party, ${local.length} local`
  );

  // Define sorting function based on configuration
  const sortImports = (a: ts.ImportDeclaration, b: ts.ImportDeclaration) => {
    const aModule = a.moduleSpecifier.getText().slice(1, -1);
    const bModule = b.moduleSpecifier.getText().slice(1, -1);

    console.log(`Sorting ${aModule} vs ${bModule} using method: ${sortMethod}`);

    let result: number;
    switch (sortMethod) {
      case "alphabetical":
        result = aModule.localeCompare(bModule);
        console.log(`Alphabetical sort result: ${result}`);
        return result;

      case "length-asc":
        result = aModule.length - bModule.length;
        console.log(`Length-asc sort result: ${result}`);
        return result;

      case "length-then-alpha":
        const lengthDiff = aModule.length - bModule.length;
        if (lengthDiff !== 0) {
          console.log(`Length-then-alpha length diff: ${lengthDiff}`);
          return lengthDiff;
        }
        result = aModule.localeCompare(bModule);
        console.log(`Length-then-alpha alpha result: ${result}`);
        return result;

      case "length-desc":
      default:
        result = bModule.length - aModule.length;
        console.log(`Length-desc sort result: ${result}`);
        return result;
    }
  };

  console.log("Sorting imports...");
  thirdParty.sort(sortImports);
  local.sort(sortImports);

  // Sort named imports within each import statement alphabetically
  const sortNamedImports = (imp: ts.ImportDeclaration) => {
    if (
      imp.importClause?.namedBindings &&
      ts.isNamedImports(imp.importClause.namedBindings)
    ) {
      const moduleSpecifier = imp.moduleSpecifier.getText().slice(1, -1);
      console.log(`Sorting named imports for ${moduleSpecifier}`);

      const sortedElements = [...imp.importClause.namedBindings.elements].sort(
        (a, b) => a.name.getText().localeCompare(b.name.getText())
      );

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

  console.log("Generated new import text, returning edit");
  return vscode.TextEdit.replace(range, newImportText);
}

export function deactivate() {
  console.log('Extension "pretty-imports" is now deactivated');
}
