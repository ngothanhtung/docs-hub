'use client';

import {
  CheckIcon,
  CircleCheckIcon,
  CopyIcon,
  FlameIcon,
  InfoIcon,
  LightbulbIcon,
  type LucideIcon,
  NotebookPenIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { DynamicIcon, type IconName, iconNames } from 'lucide-react/dynamic';
import { useTheme } from 'next-themes';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const ADMONITION_ICONS: Record<string, LucideIcon> = {
  note: NotebookPenIcon,
  tip: LightbulbIcon,
  info: InfoIcon,
  warning: TriangleAlertIcon,
  danger: FlameIcon,
  check: CircleCheckIcon,
};

const KNOWN_ICONS = new Set<string>(iconNames);

const TAB_STORAGE_KEY = 'docshub:tab';

/**
 * Hiển thị HTML bài viết (đã được API sanitize) và gắn phần tương tác phía trình duyệt:
 * icon admonition và icon lucide (`data-icon`), nút copy code, giao diện tabs/code group,
 * mở accordion chứa mục được link tới, vẽ sơ đồ Mermaid.
 */
export function DocContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const mounted: { root: Root; host: HTMLElement }[] = [];
    const mount = (host: HTMLElement, node: ReactNode) => {
      const root = createRoot(host);
      root.render(node);
      mounted.push({ root, host });
    };

    enhanceIcons(container, mount);
    enhanceAdmonitions(container, mount);
    enhanceCodeBlocks(container, mount);
    enhanceTabs(container);
    const openTarget = () => openDetailsFor(container, window.location.hash);
    openTarget();
    window.addEventListener('hashchange', openTarget);

    return () => {
      window.removeEventListener('hashchange', openTarget);
      // Gỡ khỏi DOM ngay để lần chạy effect kế tiếp (StrictMode, đổi bài) gắn lại từ đầu;
      // unmount root sau khi React render xong lượt hiện tại để tránh cảnh báo unmount đồng bộ.
      mounted.forEach(({ host }) => host.remove());
      queueMicrotask(() => mounted.forEach(({ root }) => root.unmount()));
    };
  }, [html]);

  useEffect(() => {
    const container = ref.current;
    if (container) void renderMermaid(container, resolvedTheme === 'dark');
  }, [html, resolvedTheme]);

  return (
    <div
      ref={ref}
      className="doc-content prose max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

type Mount = (host: HTMLElement, node: ReactNode) => void;

/** `<span class="icon" data-icon="rocket">` -> icon lucide. Tên không có trong lucide thì bỏ trống. */
function enhanceIcons(container: HTMLElement, mount: Mount) {
  container.querySelectorAll<HTMLElement>('span.icon[data-icon]').forEach((slot) => {
    const name = slot.dataset.icon ?? '';
    if (!KNOWN_ICONS.has(name) || slot.firstChild) return;
    const host = document.createElement('span');
    host.className = 'icon-host';
    host.style.display = 'contents';
    slot.append(host);
    mount(host, <DynamicIcon name={name as IconName} aria-hidden />);
  });
}

/** Link tới một mục nằm trong accordion đang đóng (#id) thì mở accordion đó ra. */
function openDetailsFor(container: HTMLElement, hash: string) {
  if (!hash) return;
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target || !container.contains(target)) return;
  let opened = false;
  for (let el = target.parentElement; el && el !== container; el = el.parentElement) {
    if (el instanceof HTMLDetailsElement && !el.open) {
      el.open = true;
      opened = true;
    }
  }
  // Trình duyệt không cuộn tới được phần tử nằm trong details đang đóng.
  if (opened) target.scrollIntoView();
}

function enhanceAdmonitions(container: HTMLElement, mount: Mount) {
  container.querySelectorAll<HTMLElement>('.admonition').forEach((box) => {
    const type = [...box.classList].find((c) => c.startsWith('admonition-'))?.slice(11) ?? 'note';
    const heading = box.querySelector<HTMLElement>(':scope > .admonition-heading');
    const Icon = ADMONITION_ICONS[type];
    // Tác giả đã chọn icon riêng (:::tip{icon="rocket"}) thì không thêm icon mặc định.
    if (!heading || !Icon || heading.querySelector('.admonition-icon, .icon')) return;
    const host = document.createElement('span');
    host.className = 'admonition-icon';
    heading.prepend(host);
    mount(host, <Icon className="size-4" aria-hidden />);
  });
}

function enhanceCodeBlocks(container: HTMLElement, mount: Mount) {
  container.querySelectorAll<HTMLPreElement>('pre.shiki').forEach((pre) => {
    let wrapper = pre.parentElement;
    if (!wrapper?.classList.contains('code-block')) {
      wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      pre.replaceWith(wrapper);
      wrapper.append(pre);
    }
    if (wrapper.querySelector(':scope > .code-copy')) return;
    const host = document.createElement('div');
    host.className = 'code-copy';
    wrapper.append(host);
    mount(host, <CopyButton getText={() => pre.innerText} />);
  });
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? 'Đã copy' : 'Copy code'}
      title={copied ? 'Đã copy' : 'Copy code'}
      onClick={async () => {
        await navigator.clipboard.writeText(getText());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
    </button>
  );
}

/**
 * Dựng thanh tab cho `<div class="tabs">`. Chọn "pnpm" ở một nhóm thì mọi nhóm có tab "pnpm"
 * cũng chuyển theo, và lựa chọn được nhớ cho lần sau (giống groupId của Docusaurus).
 */
function enhanceTabs(container: HTMLElement) {
  const groups = [...container.querySelectorAll<HTMLElement>('.tabs')];
  const select = (label: string) => {
    groups.forEach((group) => {
      const panels = [...group.querySelectorAll<HTMLElement>(':scope > .tab')];
      if (!panels.some((p) => p.dataset.label === label)) return;
      panels.forEach((panel) => (panel.hidden = panel.dataset.label !== label));
      group.querySelectorAll<HTMLButtonElement>(':scope > .tabs-list > button').forEach((button) => {
        const selected = button.dataset.label === label;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
    });
  };

  groups.forEach((group, groupIndex) => {
    if (group.querySelector(':scope > .tabs-list')) return;
    const panels = [...group.querySelectorAll<HTMLElement>(':scope > .tab')];
    if (panels.length === 0) return;
    const list = document.createElement('div');
    list.className = 'tabs-list';
    list.setAttribute('role', 'tablist');
    panels.forEach((panel, index) => {
      const label = panel.dataset.label ?? `Tab ${index + 1}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.label = label;
      button.setAttribute('role', 'tab');
      button.id = `tab-${groupIndex}-${index}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      button.addEventListener('click', () => {
        localStorage.setItem(TAB_STORAGE_KEY, label);
        select(label);
      });
      list.append(button);
    });
    group.prepend(list);
    const remembered = localStorage.getItem(TAB_STORAGE_KEY);
    const initial = panels.find((p) => p.dataset.label === remembered) ?? panels[0];
    select(initial.dataset.label ?? '');
  });
}

async function renderMermaid(container: HTMLElement, dark: boolean) {
  const blocks = [...container.querySelectorAll<HTMLElement>('pre.mermaid')];
  if (blocks.length === 0) return;
  blocks.forEach((block) => {
    // Lưu mã gốc để vẽ lại khi đổi giao diện sáng/tối.
    block.dataset.source ??= block.textContent ?? '';
    block.removeAttribute('data-processed');
    block.textContent = block.dataset.source;
  });
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'default',
    fontFamily: 'var(--font-sans)',
  });
  try {
    await mermaid.run({ nodes: blocks });
  } catch {
    // Sơ đồ sai cú pháp: Mermaid tự hiện thông báo lỗi trong khối, không làm hỏng cả trang.
  }
}
