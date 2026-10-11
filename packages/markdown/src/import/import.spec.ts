import { describe, expect, it } from 'vitest';
import { analyzeImport, convertImportedDoc, convertProject, type ImportFile, type ImportNode } from '../index.js';

const text = (path: string, content: string): ImportFile => ({ path, size: content.length, text: content });
const binary = (path: string): ImportFile => ({ path, size: 10 });

function outline(nodes: ImportNode[], depth = 0): string[] {
  return nodes.flatMap((n) =>
    n.kind === 'category'
      ? [`${'  '.repeat(depth)}[${n.label}] ${n.slug}`, ...outline(n.children, depth + 1)]
      : [`${'  '.repeat(depth)}${n.slug} <- ${n.key}`],
  );
}

describe('nhập từ Docusaurus', () => {
  const files = [
    text('site/docusaurus.config.ts', 'export default {}'),
    text('site/docs/intro.md', '---\nsidebar_position: 1\nslug: /\n---\n\n# Giới thiệu\n\n:::tip Mẹo hay\nĐọc [cài đặt](./basics/02-install.md#yeu-cau).\n:::\n\n![Logo](/img/logo.png)\n'),
    text('site/docs/basics/_category_.json', '{"label":"Cơ bản","position":2,"link":{"description":"Học từng bước"}}'),
    text('site/docs/basics/02-install.mdx', "import Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\nimport Shared from './_shared.mdx';\n\n# Cài đặt\n\n<Tabs>\n  <TabItem value=\"npm\" label=\"npm\">\n\n```bash\nnpm i\n```\n\n  </TabItem>\n  <TabItem value=\"yarn\">\n\n```bash\nyarn\n```\n\n  </TabItem>\n</Tabs>\n\n<details>\n<summary>Xem thêm</summary>\n\nVề [trang đầu](/docs/intro).\n\n</details>\n\n<Shared />\n\n<DocCardList />\n\n```js title=\"a.js\" live\nconst a = 1;\n```\n"),
    text('site/docs/basics/01-first.md', '# Bài đầu'),
    text('site/docs/basics/_shared.mdx', 'Đoạn **dùng chung**.'),
    binary('site/static/img/logo.png'),
  ];

  it('dựng cây theo thư mục, _category_.json, tiền tố số và sidebar_position', () => {
    const project = analyzeImport(files);
    expect(project.flavor).toBe('docusaurus');
    expect(outline(project.nodes)).toEqual([
      'intro <- site/docs/intro.md',
      '[Cơ bản] basics',
      '  first <- site/docs/basics/01-first.md',
      '  install <- site/docs/basics/02-install.mdx',
    ]);
    expect(project.skipped.map((s) => s.path)).toEqual(['site/docs/basics/_shared.mdx']);
  });

  it('chuyển admonition, Tabs, details, partial; đổi link và ảnh; bỏ import/live', () => {
    const docs = convertProject(analyzeImport(files), { assetUrl: (p) => `/assets/${p}` });
    const intro = docs.find((d) => d.path === 'intro')!;
    expect(intro.markdown).toContain(':::tip[Mẹo hay]');
    expect(intro.markdown).toContain('[cài đặt](./basics/install.md#yeu-cau)');
    expect(intro.markdown).toContain('![Logo](/assets/site/static/img/logo.png)');
    expect(intro.markdown).not.toMatch(/sidebar_position|slug:/);
    expect(intro.images).toEqual(['site/static/img/logo.png']);

    const install = docs.find((d) => d.path === 'basics/install')!;
    expect(install.markdown).not.toContain('import ');
    expect(install.markdown).toContain('::::tabs\n:::tab{label="npm"}');
    expect(install.markdown).toContain(':::tab{label="yarn"}');
    expect(install.markdown).toContain(':::accordion[Xem thêm]\nVề [trang đầu](./intro.md).');
    expect(install.markdown).toContain('Đoạn **dùng chung**.');
    expect(install.markdown).toContain('```js title="a.js"\n');
    expect(install.warnings.map((w) => w.message)).toEqual([expect.stringContaining('DocCardList')]);
  });

  it('comment highlight của Docusaurus thành dòng tô sáng; bỏ id tuỳ chỉnh của heading', () => {
    const source = '## Tiêu đề {/* #tuy-chinh */}\n\n```js\n// highlight-next-line\nconst a = 1;\nconst b = 2;\n// highlight-start\nconst c = 3;\nconst d = 4;\n// highlight-end\n```\n';
    const { markdown } = convertImportedDoc(source, { flavor: 'docusaurus', path: 'a.mdx' });
    expect(markdown).toContain('## Tiêu đề\n');
    expect(markdown).toContain('```js {1,3-4}\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\n```');
  });

  it('file không phải MDX hợp lệ vẫn nhập dạng Markdown, kèm cảnh báo', () => {
    const result = convertImportedDoc('Dòng <br> và {x}.', { flavor: 'docusaurus', path: 'a.md' });
    expect(result.markdown).toContain('Dòng <br> và {x}.');
    expect(result.warnings[0].message).toMatch(/MDX/);
  });
});

describe('nhập từ Mintlify', () => {
  const files = [
    text('docs.json', JSON.stringify({
      navigation: {
        tabs: [{ tab: 'Docs', groups: [
          { group: 'Bắt đầu', icon: 'rocket', pages: ['introduction', { group: 'Nâng cao', pages: ['advanced/hooks'] }] },
          { group: 'API', pages: ['api/users', 'GET /users'] },
        ] }],
      },
    })),
    text('introduction.mdx', [
      '---', 'title: Giới thiệu', 'sidebarTitle: Tổng quan', 'icon: rocket', '---', '',
      "import Shared from '/snippets/shared.mdx';", '',
      '<Note>Lưu ý.</Note>', '',
      '<CardGroup cols={2}>', '  <Card title="Hooks" icon="code" href="/advanced/hooks">', '    Đọc tiếp.', '  </Card>', '</CardGroup>', '',
      '<Steps>', '  <Step title="Cài đặt">', '    Chạy lệnh.', '  </Step>', '</Steps>', '',
      '<CodeGroup>', '```javascript app.js', 'console.log(1)', '```', '```python app.py highlight={1}', 'print(1)', '```', '</CodeGroup>', '',
      '<Accordion title="Hỏi" defaultOpen>', '  Đáp.', '</Accordion>', '',
      'Xem <Tooltip tip="Giải thích">từ</Tooltip>, <Badge color="green">Mới</Badge> <Icon icon="star" />.', '',
      '<Frame caption="Ảnh">', '  <img src="/images/hero.png" alt="Hero" />', '</Frame>', '',
      '<Tree>', '  <Tree.Folder name="app">', '    <Tree.File name="page.tsx" />', '  </Tree.Folder>', '</Tree>', '',
      '<Shared />', '',
      '<Mystery>Giữ nội dung</Mystery>',
    ].join('\n')),
    text('advanced/hooks.mdx', '---\ntitle: Hooks\n---\n\nXem [giới thiệu](/introduction).'),
    text('api/users.mdx', '---\ntitle: Users\n---\n\n<Warning title="Chú ý">Cẩn thận</Warning>'),
    text('snippets/shared.mdx', 'Nội dung *snippet*.'),
    text('orphan.mdx', '---\ntitle: Lạc\n---'),
    binary('images/hero.png'),
  ];

  it('dựng cây theo navigation, bỏ cấp tab duy nhất, báo trang thiếu', () => {
    const project = analyzeImport(files);
    expect(project.flavor).toBe('mintlify');
    expect(outline(project.nodes)).toEqual([
      '[Bắt đầu] bat-dau',
      '  introduction <- introduction.mdx',
      '  [Nâng cao] nang-cao',
      '    hooks <- advanced/hooks.mdx',
      '[API] api',
      '  users <- api/users.mdx',
    ]);
    expect(project.skipped.map((s) => s.path).sort()).toEqual(['GET /users', 'orphan.mdx']);
  });

  it('chuyển component Mintlify sang directive của DocsHub', () => {
    const docs = convertProject(analyzeImport(files), { assetUrl: (p) => `/assets/${p}` });
    const intro = docs.find((d) => d.path === 'bat-dau/introduction')!.markdown;
    expect(intro).toContain('sidebar_label: Tổng quan');
    expect(intro).toContain(':::note\nLưu ý.\n:::');
    expect(intro).toContain(':::card[Hooks]{icon="code" href="./bat-dau/nang-cao/hooks.md"}');
    expect(intro).toContain(':::step[Cài đặt]\nChạy lệnh.');
    expect(intro).toContain('```javascript title="app.js"');
    expect(intro).toContain('```python title="app.py" {1}');
    expect(intro).toContain(':::accordion[Hỏi]{open}');
    expect(intro).toContain(':tooltip[từ]{tip="Giải thích"}, :badge[Mới]{color="green"} :icon{name="star"}');
    expect(intro).toContain(':::frame[Ảnh]\n![Hero](/assets/images/hero.png)');
    expect(intro).toContain('```tree\napp/\n  page.tsx\n```');
    expect(intro).toContain('Nội dung _snippet_.');
    expect(intro).toContain('Giữ nội dung');

    expect(docs.find((d) => d.path === 'bat-dau/nang-cao/hooks')!.markdown).toContain('[giới thiệu](./bat-dau/introduction.md)');
    expect(docs.find((d) => d.path === 'api/users')!.markdown).toContain(':::warning[Chú ý]\nCẩn thận\n:::');
  });

  it('không chạy biểu thức JavaScript trong thuộc tính', () => {
    const result = convertImportedDoc('<Card title={process.env.SECRET} href="/x">Y</Card>\n\n{1 + 1}', {
      flavor: 'mintlify',
      path: 'a.mdx',
    });
    expect(result.markdown).not.toContain('process.env');
    expect(result.markdown).not.toContain('1 + 1');
    expect(result.warnings.map((w) => w.message)).toContain('Đã bỏ biểu thức JavaScript {1 + 1}');
  });
});
