import * as Monaco from "monaco-editor";
import { languages, Range as MonacoRange } from "monaco-editor";
import { extensionRegistry } from "@/extensions/registry/extension-registry";
import type { Snippet } from "@/extensions/types/extension-manifest";
import { filePathFromBlimyModelUri } from "./model-uri";

let providerRegistered = false;

function filePathFromModel(model: Monaco.editor.ITextModel): string {
  if (model.uri.scheme !== "blimy") {
    return decodeURIComponent(model.uri.path);
  }

  return filePathFromBlimyModelUri(model.uri.path, model.uri.query);
}

function toSnippetBody(snippet: Snippet): string {
  return Array.isArray(snippet.body) ? snippet.body.join("\n") : snippet.body;
}

export function registerMonacoSnippetProvider(): void {
  if (providerRegistered) return;
  providerRegistered = true;

  languages.registerCompletionItemProvider(
    { scheme: "blimy", pattern: "**/*" },
    {
      triggerCharacters: [],
      provideCompletionItems(model, position) {
        const filePath = filePathFromModel(model);
        const languageId = extensionRegistry.getLanguageId(filePath);
        if (!languageId) return { suggestions: [] };

        const snippets = extensionRegistry.getSnippetsForLanguage(languageId);
        if (snippets.length === 0) return { suggestions: [] };

        const word = model.getWordUntilPosition(position);
        const range = new MonacoRange(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        );

        return {
          suggestions: snippets.map((snippet) => ({
            label: snippet.prefix,
            kind: Monaco.languages.CompletionItemKind.Snippet,
            insertText: toSnippetBody(snippet),
            insertTextRules: Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: snippet.description,
            detail: `snippet: ${snippet.prefix}`,
            range,
          })),
        };
      },
    },
  );
}
