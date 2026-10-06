import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { Catalog, FlatItem, flatten } from "./catalog";
import { initI18n, t } from "./i18n";
import { GalleryView, VIEW_TYPE_GALLERY } from "./gallery-view";
import { GallerySettingTab } from "./settings";
import { createHomeProvider } from "./home";
import { notifyHomeChanged } from "./qiaomu-home";
import { demoFile, LearnData, LearnKind } from "./learnui-data";
import { exportAllLearnNotes } from "./learn-review";
import type { Collection } from "./collections";
import catalogRaw from "../data/catalog.json";
import learnuiRaw from "../data/learnui.json";
import demosRaw from "../data/demos.json";

export interface QpgSettings {
  clickAction: "preview" | "browser";
  appendSource: boolean;
  recents: string[];
  notesFolder: string;
  learnReviews: Record<string, { rating?: number; tags?: string[]; note?: string; updated?: string }>;
  quizState: Record<string, { ok: number; seen: number; m: number; last: number }>;
  density: "s" | "m" | "l";
  sideCollapsed: boolean;
  startMode: "gallery" | "dictionary" | "styles" | "quiz";
  collections: Collection[];
  replicaStack: string;
}

const DEFAULT_SETTINGS: QpgSettings = {
  clickAction: "preview",
  appendSource: false,
  recents: [],
  notesFolder: "Learn UI",
  learnReviews: {},
  quizState: {},
  density: "m",
  sideCollapsed: false,
  startMode: "gallery",
  collections: [],
  replicaStack: "React + Tailwind CSS",
};

const RECENTS_MAX = 24;

/** Scales a specimen down (never up) so list thumbnails show it whole instead of cropped. */
const FIT_SCRIPT =
  "<script>(function(){function fit(){var f=document.querySelector('.fragment');var d=f&&f.firstElementChild;if(!d)return;" +
  "f.style.transform='';var r=d.getBoundingClientRect();var w=Math.max(r.width,d.scrollWidth),h=Math.max(r.height,d.scrollHeight);if(!w||!h)return;" +
  "var s=Math.min(1,(innerWidth-24)/w,(innerHeight-24)/h);" +
  "if(s<0.995){f.style.transformOrigin='center center';f.style.transform='scale('+s+')';}}" +
  "addEventListener('load',function(){setTimeout(fit,50);setTimeout(fit,500)});addEventListener('resize',fit);})();</script>";

export default class QiaomuProductGalleryPlugin extends Plugin {
  settings: QpgSettings = DEFAULT_SETTINGS;
  catalog: Catalog | null = null;
  catalogError = false;
  flatItems: FlatItem[] = [];
  onCatalogReady: Array<() => void> = [];

  learnui: LearnData | null = null;
  learnuiError = false;
  onLearnuiReady: Array<() => void> = [];

  async onload(): Promise<void> {
    initI18n();
    await this.loadSettings();
    this.registerView(VIEW_TYPE_GALLERY, (leaf: WorkspaceLeaf) => new GalleryView(leaf, this));

    this.addRibbonIcon("graduation-cap", t("ribbon.label"), () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-gallery",
      name: t("command.open"),
      callback: () => {
        void this.activateView();
      },
    });
    this.addCommand({
      id: "open-dictionary",
      name: t("command.dictionary"),
      callback: () => {
        void this.activateLearn("dictionary");
      },
    });
    this.addCommand({
      id: "open-styles",
      name: t("command.styles"),
      callback: () => {
        void this.activateLearn("styles");
      },
    });
    this.addCommand({
      id: "open-quiz",
      name: t("command.quiz"),
      callback: () => {
        void this.activateLearn("quiz");
      },
    });
    this.addCommand({
      id: "export-learn-notes",
      name: t("command.exportNotes"),
      callback: async () => {
        const n = await exportAllLearnNotes(this);
        new Notice(n > 0 ? t("command.exportDone", { n }) : t("review.exportEmpty"));
      },
    });

    this.addSettingTab(new GallerySettingTab(this.app, this));

    // Qiaomu Home integration: recent designs, browse action, local search.
    (this as Plugin & { qiaomuHome?: unknown }).qiaomuHome = createHomeProvider(this);

    this.app.workspace.onLayoutReady(() => {
      void this.loadCatalog();
      void this.loadLearnui();
    });
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<QpgSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    this.settings.learnReviews = this.settings.learnReviews ?? {};
    this.settings.quizState = this.settings.quizState ?? {};
    this.settings.collections = Array.isArray(this.settings.collections) ? this.settings.collections : [];
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async loadCatalog(): Promise<void> {
    try {
      const catalog = JSON.parse(catalogRaw) as Catalog;
      if (!catalog || !Array.isArray(catalog.cats) || !catalog.items) {
        throw new Error("invalid catalog");
      }
      this.catalog = catalog;
      this.flatItems = flatten(catalog);
    } catch (e) {
      console.error("[qiaomu-ui-learn] catalog load failed", e);
      this.catalogError = true;
    }
    const callbacks = this.onCatalogReady;
    this.onCatalogReady = [];
    for (const cb of callbacks) cb();
  }

  private async loadLearnui(): Promise<void> {
    try {
      const data = JSON.parse(learnuiRaw) as LearnData;
      if (!data || !Array.isArray(data.entries) || !Array.isArray(data.styles)) throw new Error("invalid learnui data");
      this.learnui = data;
    } catch (e) {
      console.error("[qiaomu-ui-learn] learnui load failed", e);
      this.learnuiError = true;
    }
    const callbacks = this.onLearnuiReady;
    this.onLearnuiReady = [];
    for (const cb of callbacks) cb();
  }

  // ---- demo specimens -------------------------------------------------------

  private demoMap: Record<string, string> | null = null;

  private demos(): Record<string, string> {
    if (!this.demoMap) this.demoMap = JSON.parse(demosRaw) as Record<string, string>;
    return this.demoMap;
  }
  private demoCache = new Map<string, Promise<string>>();

  /** Full srcdoc for a demo specimen (site.css + demo fragment, offline). */
  loadDemoHtml(kind: LearnKind, slug: string, fit = false): Promise<string> {
    const file = demoFile(kind, slug);
    const cacheKey = fit ? `${file}#fit` : file;
    let p = this.demoCache.get(cacheKey);
    if (!p) {
      p = (async () => {
        const demos = this.demos();
        const css = demos["site.css"] ?? "";
        const html = demos[file];
        if (html === undefined) throw new Error(`missing specimen ${file}`);
        return [
          "<!DOCTYPE html><html><head><meta charset='utf-8'><style>",
          css,
          fit
            ? "html,body{height:100%;margin:0;background:transparent !important}"
            : "html,body{height:100%;margin:0;background:#f6f6f3 radial-gradient(rgba(20,20,20,.09) 1px,transparent 1px) 0 0/14px 14px !important}",
          ".stage{height:100%;border:0;border-radius:0;background:transparent}",
          ".stage-center{padding:16px}",
          "</style></head><body>",
          `<div class="stage"><div class="stage-center"><div class="fragment">${html}</div></div></div>`,
          fit ? FIT_SCRIPT : "",
          "</body></html>",
        ].join("\n");
      })();
      this.demoCache.set(cacheKey, p);
    }
    return p;
  }

  // ---- view activation ------------------------------------------------------

  async activateView(): Promise<GalleryView | null> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_GALLERY);
    const leaf = existing.length > 0 ? existing[0] : workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_GALLERY, active: true });
    await workspace.revealLeaf(leaf);
    const view = leaf.view;
    return view instanceof GalleryView ? view : null;
  }

  async activateLearn(mode: "dictionary" | "styles" | "quiz"): Promise<void> {
    const view = await this.activateView();
    view?.setMode(mode);
  }

  private recentsTimer: number | null = null;

  rememberRecent(item: FlatItem): void {
    const recents = this.settings.recents.filter((k) => k !== item.key);
    recents.unshift(item.key);
    this.settings.recents = recents.slice(0, RECENTS_MAX);
    if (this.recentsTimer !== null) window.clearTimeout(this.recentsTimer);
    this.recentsTimer = window.setTimeout(() => {
      this.recentsTimer = null;
      void this.saveSettings();
    }, 1500);
    notifyHomeChanged(this.app, this.manifest.id);
  }

  private itemIndex: Map<string, FlatItem> | null = null;

  /** Resolve keys (recents, collections) to items; drops keys that no longer resolve. */
  itemsByKeys(keys: string[]): FlatItem[] {
    if (!this.itemIndex || this.itemIndex.size !== this.flatItems.length) {
      this.itemIndex = new Map(this.flatItems.map((it) => [it.key, it]));
    }
    const idx = this.itemIndex;
    return keys.map((k) => idx.get(k)).filter((it): it is FlatItem => !!it);
  }

  recentItems(): FlatItem[] {
    return this.itemsByKeys(this.settings.recents);
  }
}
