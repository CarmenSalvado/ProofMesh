import { JupyterFrontEnd, JupyterFrontEndPlugin } from "@jupyterlab/application";
import { IDefaultFileBrowser } from "@jupyterlab/filebrowser";
import { INotebookTracker, NotebookActions } from "@jupyterlab/notebook";
import { Drive, ServerConnection } from "@jupyterlab/services";

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;0,500;1,400&display=swap');

:root {
  --jp-ui-font-family: 'Inter', system-ui, sans-serif;
  --jp-code-font-family: 'JetBrains Mono', ui-monospace, monospace;
  --jp-content-font-family: 'Newsreader', 'Georgia', serif;
  --jp-layout-color0: #09090b;
  --jp-layout-color1: #18181b;
  --jp-layout-color2: #27272a;
  --jp-layout-color3: #3f3f46;
  --jp-border-color0: #27272a;
  --jp-border-color1: #3f3f46;
  --jp-border-color2: #52525b;
  --jp-ui-font-size1: 13px;
  --jp-ui-font-size2: 14px;
  --jp-content-font-size1: 15px;
  --jp-content-link-color: #818cf8;
  --jp-brand-color1: #818cf8;
  --jp-brand-color2: #6366f1;
  --jp-brand-color3: #4f46e5;
}

.jp-Toolbar {
  border-bottom: 1px solid var(--jp-border-color1);
}

.jp-NotebookPanel {
  background: transparent;
}

.jp-Notebook {
  background: transparent;
}

.jp-Notebook .jp-Cell {
  border-radius: 12px;
  border: 1px solid var(--jp-border-color1);
  padding: 4px 8px;
  margin-bottom: 12px;
  background: rgba(24, 24, 27, 0.7);
}

.jp-Notebook .jp-Cell.jp-mod-active {
  border-color: #6366f1;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.4);
}

.jp-DirListing-item.jp-mod-selected {
  background: rgba(99, 102, 241, 0.15);
}
`;

const plugin: JupyterFrontEndPlugin<void> = {
  id: "proofmesh-bridge:contents",
  autoStart: true,
  requires: [IDefaultFileBrowser, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    defaultBrowser: IDefaultFileBrowser,
    notebookTracker: INotebookTracker
  ) => {
    const url = new URL(window.location.href);
    const workspaceId = url.searchParams.get("workspace") || "";
    const apiBase = url.searchParams.get("api") || window.location.origin;

    if (!workspaceId) {
      console.warn("[ProofMesh] Missing workspace id, using local storage only.");
      return;
    }

    const token = window.localStorage.getItem("access_token") || "";
    const baseUrl = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;

    const serverSettings = ServerConnection.makeSettings({
      baseUrl,
      init: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    const drive = new Drive({
      name: "pm",
      apiEndpoint: `api/workspaces/${workspaceId}/contents`,
      serverSettings,
    });

    app.serviceManager.contents.addDrive(drive);
    (defaultBrowser.model as any).driveName = drive.name;
    defaultBrowser.model.refresh().catch(() => null);

    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    const broadcastContext = () => {
      const widget = notebookTracker.currentWidget;
      if (!widget) {
        window.parent?.postMessage({ type: "proofmesh:context", payload: null }, "*");
        return;
      }

      const cell = notebookTracker.activeCell;
      const payload = {
        path: widget.context.path,
        cellId: cell?.model.id ?? null,
        cellType: cell?.model.type ?? null,
        cellSource: cell?.model.sharedModel.getSource() ?? "",
      };

      window.parent?.postMessage({ type: "proofmesh:context", payload }, "*");
    };

    const insertCell = (cellType: "markdown" | "code", source: string) => {
      const widget = notebookTracker.currentWidget;
      if (!widget) return;
      const notebook = widget.content;
      NotebookActions.insertBelow(notebook);
      NotebookActions.changeCellType(notebook, cellType);
      const active = notebook.activeCell;
      if (active) {
        active.model.sharedModel.setSource(source);
      }
    };

    notebookTracker.currentChanged.connect(broadcastContext);
    notebookTracker.activeCellChanged.connect(broadcastContext);

    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "proofmesh:requestContext") {
        broadcastContext();
      }
      if (data.type === "proofmesh:insertCell") {
        const payload = data.payload || {};
        const cellType = payload.cellType === "code" ? "code" : "markdown";
        const source = typeof payload.source === "string" ? payload.source : "";
        insertCell(cellType, source);
      }
    });
  },
};

export default plugin;
