import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './index.js';

describe('thành phần kiểu Mintlify', () => {
  it('callout check và icon tuỳ chọn', async () => {
    const { html } = await renderMarkdown(':::check{icon="rocket"}\nXong.\n:::');
    expect(html).toContain('class="admonition admonition-check"');
    expect(html).toContain('<span class="icon" data-icon="rocket"></span>Thành công');
  });

  it('steps đánh số, tiêu đề từ [ ] hoặc title, cảnh báo nội dung lạc', async () => {
    const { html, warnings } = await renderMarkdown(
      '::::steps\n:::step[Cài **CLI**]\nA\n:::\n:::step{title="Chạy"}\nB\n:::\nlạc\n::::',
    );
    expect(html).toContain('<ol class="steps">');
    expect(html).toContain('<div class="step-title">Cài <strong>CLI</strong></div>');
    expect(html).toContain('<div class="step-title">Chạy</div>');
    expect(html).not.toContain('lạc');
    expect(warnings.map((w) => w.rule)).toEqual(['component-content']);
  });

  it('accordion dùng details, mở sẵn khi có {open}', async () => {
    const { html } = await renderMarkdown(
      '::::accordion-group\n:::accordion[Vì sao?]{open}\nVì dễ test.\n:::\n:::expandable[Thêm]\nX\n:::\n::::',
    );
    expect(html).toContain('<div class="accordion-group"><details class="accordion" open><summary>Vì sao?</summary>');
    expect(html).toContain('<details class="expandable"><summary>Thêm</summary>');
  });

  it('columns + card: link nội bộ được đổi URL và kiểm tra hỏng', async () => {
    const { html, warnings } = await renderMarkdown(
      '::::columns{cols=9}\n:::card[Module]{href="./module.md" icon="boxes" cta="Đọc tiếp" type="tip"}\nNội dung\n:::\n::card[Hỏng]{href="./khong-co.md"}\n::::',
      { resolveUrl: (url) => (url === './module.md' ? '/courses/c/v/module' : null) },
    );
    expect(html).toContain('<div class="columns" data-cols="4">');
    expect(html).toContain('<a href="/courses/c/v/module" class="card card-tip">');
    expect(html).toContain('<div class="card-cta">Đọc tiếp</div>');
    expect(warnings.map((w) => w.rule)).toEqual(['broken-link']);
  });

  it('code-group thành tabs, nhãn từ title hoặc ngôn ngữ', async () => {
    const { html } = await renderMarkdown(
      '::::code-group\n```ts title="app.ts"\nconst a = 1;\n```\n```bash\npnpm i\n```\n::::',
    );
    expect(html).toContain('<div class="tabs code-group"><div class="tab" data-label="app.ts">');
    expect(html).toContain('data-label="Bash"');
    expect(html).not.toContain('code-block-title');
  });

  it('chú thích trong code: diff, focus, highlight', async () => {
    const { html } = await renderMarkdown(
      '```ts\nconst a = 1; // [!code ++]\nconst b = 2; // [!code --]\nconst c = 3; // [!code focus]\nconst d = 4; // [!code highlight]\n```',
    );
    expect(html).toContain('has-diff');
    expect(html).toContain('class="line diff add"');
    expect(html).toContain('class="line diff remove"');
    expect(html).toContain('class="line focused"');
    expect(html).toContain('class="line highlighted"');
    expect(html).not.toContain('[!code');
  });

  it('frame, badge, icon, tooltip', async () => {
    const { html } = await renderMarkdown(
      ':::frame[Chú thích]\n![a](https://x.dev/a.png)\n:::\n\n:badge[Mới]{color="green"} :badge[Lạ]{color="hotpink"} :icon{name="star"} :tooltip[DI]{tip="Dependency Injection"}',
    );
    expect(html).toContain('<figure class="frame">');
    expect(html).toContain('<figcaption>Chú thích</figcaption>');
    expect(html).toContain('<span class="badge badge-green">Mới</span>');
    expect(html).toContain('<span class="badge badge-gray">Lạ</span>');
    expect(html).toContain('<span class="icon" data-icon="star"></span>');
    expect(html).toContain(
      '<span class="tooltip" tabindex="0">DI<span class="tooltip-content" role="tooltip">Dependency Injection</span></span>',
    );
  });

  it('cây thư mục từ thụt lề và từ kết quả lệnh tree', async () => {
    const indented = await renderMarkdown('```tree\nsrc/\n  app.ts   # gốc\n  users/\n    a.ts\n```');
    expect(indented.html).toContain('<div class="file-tree">');
    expect(indented.html).toContain('<span class="file-tree-name">app.ts</span><span class="file-tree-comment">gốc</span>');
    expect(indented.html.match(/data-icon="folder"/g)).toHaveLength(2);

    const pasted = await renderMarkdown('```tree\nsrc\n├── app.ts\n└── users\n    └── a.ts\n```');
    expect(pasted.html.match(/data-icon="folder"/g)).toHaveLength(2);
    expect(pasted.html.match(/data-icon="file"/g)).toHaveLength(2);
  });

  describe('bảo mật', () => {
    it('card không nhận href javascript:, class lạ và tên icon lạ', async () => {
      const { html, warnings } = await renderMarkdown(
        ':::card[X]{href="javascript:alert(1)" type="evil" icon="<img>"}\nY\n:::',
      );
      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('evil');
      expect(html).not.toContain('<img');
      expect(warnings.map((w) => w.rule)).toContain('icon-name');
    });

    it('tooltip không có tip và directive lạ giữ nguyên chữ', async () => {
      const { html } = await renderMarkdown('Xem :tooltip[DI] và :unknown[x].');
      expect(html).toContain('Xem :tooltip[DI] và :unknown[x].');
    });

    it('nội dung tree được thoát HTML', async () => {
      const { html } = await renderMarkdown('```tree\n<script>alert(1)</script>\n```');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&#x3C;script>');
    });
  });
});
