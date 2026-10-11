import { renderMarkdown } from '@docshub/markdown';
import { htmlToText, splitSections } from './sections.js';

describe('splitSections', () => {
  it('tách theo h2/h3, giữ phần mở đầu và bỏ ký tự anchor', async () => {
    const { html } = await renderMarkdown(
      'Mở đầu bài.\n\n## Cài đặt\n\nChạy `pnpm i`.\n\n### Dùng pnpm\n\nNhanh hơn & gọn hơn.\n\n## Trống',
    );
    expect(splitSections(html)).toEqual([
      { anchor: null, heading: null, content: 'Mở đầu bài.' },
      { anchor: 'cài-đặt', heading: 'Cài đặt', content: 'Chạy pnpm i .' },
      { anchor: 'dùng-pnpm', heading: 'Dùng pnpm', content: 'Nhanh hơn & gọn hơn.' },
      { anchor: 'trống', heading: 'Trống', content: '' },
    ]);
  });

  it('không lấy chữ trong svg và MathML của KaTeX', async () => {
    const { html } = await renderMarkdown('Công thức $E = mc^2$ đây.');
    const [section] = splitSections(html);
    expect(section.content).not.toContain('annotation');
    expect(section.content).toContain('đây.');
  });
});

describe('htmlToText', () => {
  it('giải mã entity', () => {
    expect(htmlToText('<p>a &lt;b&gt; &amp; &#x27;c&#39;</p>')).toBe("a <b> & 'c'");
  });
});
