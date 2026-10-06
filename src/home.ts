import { FlatItem, thumbUrl } from "./catalog";
import { t } from "./i18n";
import { DesignModal } from "./design-modal";
import { homeProvider, HomeItem, HomeProvider, HomeSection } from "./qiaomu-home";
import type QiaomuProductGalleryPlugin from "./main";

export function createHomeProvider(plugin: QiaomuProductGalleryPlugin): HomeProvider {
  function itemToHome(item: FlatItem): HomeItem {
    return {
      id: item.key,
      title: item.row[0],
      subtitle: item.cat.n,
      image: thumbUrl(item.row) ?? undefined,
      icon: "image",
      open: () => {
        plugin.rememberRecent(item);
        new DesignModal(plugin.app, plugin, [item], 0).open();
      },
    };
  }

  return homeProvider({
    sections(): HomeSection[] {
      const items = plugin.recentItems().slice(0, 6).map(itemToHome);
      return [
        {
          id: "recent-designs",
          title: t("home.recent.title"),
          items,
          empty: t("home.recent.empty"),
          more: {
            id: "open-gallery",
            label: t("home.action.browse"),
            icon: "layout-grid",
            run: () => void plugin.activateView(),
          },
        },
      ];
    },
    actions() {
      return [
        {
          id: "browse-designs",
          label: t("home.action.browse"),
          icon: "layout-grid",
          run: () => void plugin.activateView(),
        },
      ];
    },
    search(query: string, limit: number): HomeItem[] {
      const q = query.trim().toLowerCase();
      if (!q || !plugin.flatItems) return [];
      return plugin.flatItems
        .filter((it) => it.lowerName.includes(q))
        .sort((a, b) => {
          const pa = a.lowerName.startsWith(q) ? 0 : 1;
          const pb = b.lowerName.startsWith(q) ? 0 : 1;
          return pa - pb;
        })
        .slice(0, limit)
        .map(itemToHome);
    },
  });
}
