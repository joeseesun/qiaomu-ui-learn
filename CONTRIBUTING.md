# Contributing / 参与贡献

Issues and pull requests are welcome. 欢迎提 Issue 和 PR。

```bash
npm install
npm run dev        # watch build -> main.js
npm run build      # type-check + production bundle
npm run check-i18n # zh / en dictionaries must cover the same keys
```

- Copy `main.js`, `manifest.json`, `styles.css` into `<vault>/.obsidian/plugins/qiaomu-ui-learn/` to try a build.
- UI strings live in `src/i18n.ts` (add every key to both `en` and `zh`).
- `data/catalog.json` and `data/learnui.json` / `data/demos.json` are bundled into `main.js` at build time; the Learn UI data is regenerated from `vendor/learnui/` with `npm run build:learnui`.
- Keep the visual language: ink-on-paper, no accent colour, follow the Obsidian theme.
