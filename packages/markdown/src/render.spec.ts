import { describe, expect, it } from 'vitest';
import { FrontmatterError, renderMarkdown } from './index.js';

describe('renderMarkdown', () => {
  it('đọc frontmatter, lấy tiêu đề và thời lượng đọc', async () => {
    const result = await renderMarkdown(
      '---\ntitle: Provider\nsidebar_position: 3\ntags: [di]\n---\n\n# Bỏ qua\n\nNội dung bài.',
    );
    expect(result.frontmatter).toMatchObject({ title: 'Provider', sidebar_position: 3, tags: ['di'] });
    expect(result.title).toBe('Provider');
    expect(result.readingTime).toBe(1);
  });

  it('lấy tiêu đề từ h1 khi frontmatter không có title', async () => {
    const result = await renderMarkdown('# NestJS là gì?\n\nMột framework Node.js.');
    expect(result.title).toBe('NestJS là gì?');
    expect(result.description).toBe('Một framework Node.js.');
  });

  it('báo lỗi frontmatter YAML sai kèm số dòng', async () => {
    const error = await renderMarkdown('---\ntitle: [chưa đóng\n---\nabc').catch((e) => e);
    expect(error).toBeInstanceOf(FrontmatterError);
    expect(error.line).toBe(2);
  });

  it('báo lỗi khi frontmatter sai kiểu', async () => {
    await expect(renderMarkdown('---\nsidebar_position: "ba"\n---\n')).rejects.toThrow(
      /sidebar_position/,
    );
  });

  describe('bảo mật', () => {
    it('bỏ HTML thô và URL javascript:', async () => {
      const { html } = await renderMarkdown(
        '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bấm](javascript:alert(1))',
      );
      expect(html).not.toContain('<script');
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('javascript:');
    });

    it('không cho class tuỳ ý qua directive', async () => {
      const { html } = await renderMarkdown(':::tip{.evil onclick="x"}\nabc\n:::');
      expect(html).not.toContain('evil');
      expect(html).not.toContain('onclick');
    });
  });

  describe('admonition', () => {
    it('dùng tiêu đề mặc định tiếng Việt', async () => {
      const { html } = await renderMarkdown(':::warning\nCẩn thận.\n:::');
      expect(html).toContain('class="admonition admonition-warning"');
      expect(html).toContain('<div class="admonition-heading">Cảnh báo</div>');
      expect(html).toContain('<div class="admonition-content">');
      expect(html).toContain('Cẩn thận.');
    });

    it('dùng tiêu đề trong [ ]', async () => {
      const { html } = await renderMarkdown(':::tip[Mẹo **hay**]\nabc\n:::');
      expect(html).toContain('<div class="admonition-heading">Mẹo <strong>hay</strong></div>');
    });
  });

  it('dựng tabs và cảnh báo nội dung nằm ngoài tab', async () => {
    const { html, warnings } = await renderMarkdown(
      '::::tabs\n:::tab{label="npm"}\nnpm i\n:::\nlạc chỗ\n:::tab\npnpm add\n:::\n::::',
    );
    expect(html).toContain('<div class="tabs">');
    expect(html).toContain('<div class="tab" data-label="npm">');
    expect(html).toContain('<div class="tab" data-label="Tab 2">');
    expect(html).not.toContain('lạc chỗ');
    expect(warnings.map((w) => w.rule)).toContain('tabs-content');
  });

  it('nhúng YouTube với ID hợp lệ, bỏ ID sai', async () => {
    const ok = await renderMarkdown('::youtube{id="dQw4w9WgXcQ"}');
    expect(ok.html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    const bad = await renderMarkdown('::youtube{id="javascript:alert(1)"}');
    expect(bad.html).not.toContain('iframe');
    expect(bad.warnings[0]).toMatchObject({ rule: 'embed-id', line: 1 });
  });

  it('giữ nguyên chữ khi gặp directive lạ', async () => {
    const { html } = await renderMarkdown('Giờ học lúc 10:30, xem mục:abc nhé.');
    expect(html).toContain('10:30');
    expect(html).toContain('mục:abc nhé');
  });

  describe('code block', () => {
    it('tô màu bằng Shiki, có tiêu đề, highlight dòng và số dòng', async () => {
      const { html } = await renderMarkdown(
        '```ts title="app.module.ts" {2} showLineNumbers\nconst a = 1;\nconst b = 2;\n```',
      );
      expect(html).toContain('<div class="code-block-title">app.module.ts</div>');
      expect(html).toContain('class="shiki shiki-themes github-light github-dark line-numbers"');
      expect(html).toContain('class="line highlighted"');
      expect(html).not.toContain('metastring');
    });

    it('ngôn ngữ lạ vẫn hiển thị dạng text', async () => {
      const { html } = await renderMarkdown('```khongtontai\nabc\n```');
      expect(html).toContain('class="shiki');
      expect(html).toContain('abc');
    });

    it('để mermaid cho client vẽ', async () => {
      const { html } = await renderMarkdown('```mermaid\ngraph TD; A-->B\n```');
      expect(html).toContain('<pre class="mermaid">graph TD; A-->B</pre>');
    });
  });

  it('giữ đường dẫn ảnh nội bộ và cho ảnh tải lười', async () => {
    const { html } = await renderMarkdown('![Sơ đồ DI](/api/v1/assets/0193a1b2-0000-7000-8000-000000000001)');
    expect(html).toContain(
      '<img src="/api/v1/assets/0193a1b2-0000-7000-8000-000000000001" alt="Sơ đồ DI" loading="lazy" decoding="async">',
    );
  });

  it('render công thức KaTeX', async () => {
    const { html } = await renderMarkdown('Công thức $E = mc^2$\n\n$$\na^2 + b^2\n$$');
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
  });

  it('tạo mục lục h2–h3 và anchor cho heading', async () => {
    const { toc, html } = await renderMarkdown(
      '# Tiêu đề\n\n## Cài đặt\n\n### Dùng pnpm\n\n#### Bỏ qua\n\n## Cài đặt',
    );
    expect(toc).toEqual([
      { depth: 2, id: 'cài-đặt', text: 'Cài đặt' },
      { depth: 3, id: 'dùng-pnpm', text: 'Dùng pnpm' },
      { depth: 2, id: 'cài-đặt-1', text: 'Cài đặt' },
    ]);
    expect(html).toContain('class="heading-anchor"');
  });

  describe('link và lint', () => {
    const resolveUrl = (url: string) =>
      url === './02-provider.md' ? '/courses/nestjs/2026/kien-truc/provider' : null;

    it('đổi link nội bộ và cảnh báo link hỏng', async () => {
      const { html, warnings } = await renderMarkdown(
        '[Provider](./02-provider.md) và [hỏng](./khong-co.md) và [ngoài](https://nestjs.com)',
        { resolveUrl },
      );
      expect(html).toContain('href="/courses/nestjs/2026/kien-truc/provider"');
      expect(html).toContain('href="https://nestjs.com" target="_blank" rel="noopener noreferrer"');
      expect(warnings).toEqual([
        { rule: 'broken-link', message: 'Link nội bộ "./khong-co.md" không trỏ tới bài nào', line: 1 },
      ]);
    });

    it('cảnh báo ảnh thiếu alt và heading nhảy cấp, kèm số dòng tính cả frontmatter', async () => {
      const { warnings } = await renderMarkdown(
        '---\ntitle: A\n---\n\n## Mở đầu\n\n#### Sâu quá\n\n![](https://example.com/a.png)',
      );
      expect(warnings).toEqual([
        { rule: 'heading-increment', message: 'Heading nhảy từ h2 xuống h4', line: 7 },
        { rule: 'image-alt', message: 'Ảnh "https://example.com/a.png" thiếu mô tả (alt)', line: 9 },
      ]);
    });
  });
});
