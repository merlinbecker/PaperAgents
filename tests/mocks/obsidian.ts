// Minimal Obsidian API mocks for Node test environment
export class TFile {
  path: string;
  name: string;
  stat: { size: number; mtime: number };
  extension: string;
  constructor(path: string, size = 0, mtime = Date.now()) {
    this.path = path;
    this.name = path.split("/").pop() || path;
    this.stat = { size, mtime };
    const parts = this.name.split(".");
    this.extension = parts.length > 1 ? parts.pop() || "" : "";
  }
}

export class TFolder {
  path: string;
  name: string;
  children: Array<TFile | TFolder> = [];
  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").filter(Boolean).pop() || "";
  }
}

export class Vault {
  private files: Map<string, string> = new Map();
  private root: TFolder = new TFolder("/");

  private ensureFolder(path: string): TFolder {
    const parts = path.split("/").filter(Boolean);
    let current = this.root;
    let currentPath = "";
    for (const part of parts) {
      currentPath += `/${part}`;
      let next = current.children.find((c) => c instanceof TFolder && c.path === currentPath) as TFolder | undefined;
      if (!next) {
        next = new TFolder(currentPath);
        current.children.push(next);
      }
      current = next;
    }
    return current;
  }

  getRoot(): TFolder {
    return this.root;
  }

  getFiles(): TFile[] {
    return Array.from(this.files.keys()).map((p) => new TFile(p, (this.files.get(p) || "").length));
  }

  getMarkdownFiles(): TFile[] {
    return this.getFiles().filter((f) => f.extension === "md");
  }

  getAbstractFileByPath(path: string): TFile | TFolder | null {
    if (this.files.has(path)) {
      return new TFile(path, (this.files.get(path) || "").length);
    }
    const parts = path.split("/").filter(Boolean);
    let current: TFolder | null = this.root;
    let currentPath = "";
    for (const part of parts) {
      currentPath += `/${part}`;
      const next = current?.children.find((c) => c instanceof TFolder && c.path === currentPath) as TFolder | undefined;
      if (!next) return null;
      current = next;
    }
    return current;
  }

  async read(file: TFile): Promise<string> {
    return this.files.get(file.path) || "";
  }

  async readBinary(file: TFile): Promise<ArrayBuffer> {
    const txt = file ? (this.files.get(file.path) || "") : "";
    return new TextEncoder().encode(txt).buffer;
  }

  async modify(file: TFile, data: string): Promise<void> {
    this.files.set(file.path, data);
  }

  async create(path: string, data: string): Promise<TFile> {
    this.files.set(path, data);
    const folderPath = path.split("/").slice(0, -1).join("/") || "/";
    const folder = this.ensureFolder(folderPath);
    const tfile = new TFile(path, data.length);
    if (!folder.children.find((c) => c instanceof TFile && c.path === path)) {
      folder.children.push(tfile);
    }
    return tfile;
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}

export class Workspace {
  on(_event: string, _cb: (...args: any[]) => void) {
    // noop in tests
    return () => {};
  }
  getActiveFile(): TFile | null {
    return null;
  }
}

export async function requestUrl(_opts: any): Promise<{ status: number; statusText?: string; json?: any; text?: string; headers?: Record<string, string> }> {
  // Deterministic fake response; can be overridden per test using vi.mock
  return { status: 200, statusText: "OK", json: { ok: true }, text: "ok", headers: { "content-type": "application/json" } };
}

export class App {
  vault = new Vault();
  workspace = new Workspace();
}

export const app = new App();
