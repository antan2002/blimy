import { editor as monacoEditor } from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import {
  openExternalBrowserUrl,
  resolveExternalBrowserUrl,
} from "@/features/window/utils/external-navigation";

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker: (_workerId: string, label: string) => Worker;
    };
    __BlimyMonacoContextMenuInitialized?: boolean;
    __BlimyMonacoExternalLinkOpenerInitialized?: boolean;
    __BlimyMonacoEditorOpenerInitialized?: boolean;
    __BlimyMonacoTextModelServiceInitialized?: boolean;
  }
}

if (typeof window !== "undefined") {
  if (!window.__BlimyMonacoEditorOpenerInitialized) {
    window.__BlimyMonacoEditorOpenerInitialized = true;
    monacoEditor.registerEditorOpener({
      openCodeEditor: async (...args) => {
        const { BlimyEditorOpener } = await import("./editor-opener");
        return BlimyEditorOpener.openCodeEditor(...args);
      },
    });
  }
  if (!window.__BlimyMonacoTextModelServiceInitialized) {
    window.__BlimyMonacoTextModelServiceInitialized = true;
    void import("./text-model-resolver")
      .then(({ installFileBackedTextModelService }) => installFileBackedTextModelService())
      .catch((error: unknown) => console.error("Failed to install the file model service:", error));
  }
  if (!window.__BlimyMonacoExternalLinkOpenerInitialized) {
    window.__BlimyMonacoExternalLinkOpenerInitialized = true;
    monacoEditor.registerLinkOpener({
      open: (resource) => {
        const url = resolveExternalBrowserUrl(resource.toString(true));
        if (!url) return false;

        void openExternalBrowserUrl(url);
        return true;
      },
    });
  }

  if (!window.__BlimyMonacoContextMenuInitialized) {
    window.__BlimyMonacoContextMenuInitialized = true;
    for (const editor of monacoEditor.getEditors()) {
      editor.updateOptions({ contextmenu: false });
    }
    monacoEditor.onDidCreateEditor((editor) => {
      editor.updateOptions({ contextmenu: false });
    });
  }

  window.MonacoEnvironment = {
    getWorker: (_workerId, label) => {
      if (label === "json") return new JsonWorker();
      if (label === "css" || label === "scss" || label === "less") return new CssWorker();
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new HtmlWorker();
      }
      if (label === "typescript" || label === "javascript") return new TsWorker();
      return new EditorWorker();
    },
  };
}
