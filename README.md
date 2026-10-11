# DocsHub

Nền tảng viết và đọc tài liệu khoá học bằng Markdown, tổ chức theo kiểu Docusaurus.
Tài liệu sản phẩm: PRD DocsHub.

| Thư mục             | Nội dung                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `apps/api`          | NestJS 12 API (Prisma 7 + PostgreSQL)                             |
| `packages/markdown` | Pipeline Markdown dùng chung cho API và web (preview = trang đọc) |
| `apps/web`          | Next.js 16: trang đọc cho học viên, Studio soạn bài, đăng nhập    |

## Chạy lần đầu

Cần Node 24, pnpm 10, Docker.

```bash
pnpm install
pnpm db:up                                # PostgreSQL, Redis, Meilisearch, RustFS (S3)
cp apps/api/.env.example apps/api/.env    # sửa JWT_ACCESS_SECRET
pnpm --filter @docshub/markdown build
pnpm --filter @docshub/api db:deploy      # áp migration
pnpm --filter @docshub/api db:generate    # sinh Prisma Client
pnpm --filter @docshub/api db:seed        # tạo admin từ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
pnpm --filter @docshub/api start:dev
```

Chạy web (cửa sổ terminal khác):

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @docshub/web dev
pnpm --filter @docshub/api seed:demo      # (tuỳ chọn) khoá học mẫu + học viên hocvien@docshub.local / Hocvien@123
```

- Web: http://localhost:3999
- API: http://localhost:4999/api/v1
- Swagger: http://localhost:4999/api/docs (tắt khi `NODE_ENV=production`)
- Health: http://localhost:4999/api/v1/health

## Kiểm tra

```bash
pnpm build && pnpm lint && pnpm test            # toàn monorepo
pnpm --filter @docshub/api test:e2e             # e2e trên database docshub_test
```

E2E chỉ chạy trên database tên `docshub_test` và tự dọn dữ liệu của lần chạy trước.

## Thử API bằng Postman

Import 2 file trong [docs/postman](docs/postman): `DocsHub.postman_collection.json` và
`DocsHub.local.postman_environment.json`, chọn environment **DocsHub Local**, rồi Run collection.
Token và id được tự lưu sau mỗi request. Chạy bằng dòng lệnh:

```bash
npx newman run docs/postman/DocsHub.postman_collection.json -e docs/postman/DocsHub.local.postman_environment.json
```

Thêm endpoint thì sửa `docs/postman/build_collection.py` rồi chạy lại `python3 build_collection.py`.

## Studio soạn bài

Vào `/studio/<slug-khoá-học>` (hoặc nút **Soạn bài** ở trang chủ / trang đọc). Chủ khoá và biên tập viên mới thấy.

- Cây nội dung: kéo biểu tượng ⋮⋮ để sắp xếp trong cùng một nhóm, menu "…" để thêm, sửa, chuyển nhóm, lưu trữ, xoá.
- Editor: tự lưu bản nháp sau 2 giây ngừng gõ; **Ctrl/⌘+S** lưu thành revision; gõ `/` ở đầu dòng để chèn khối (tip, code, bảng, tabs, mermaid...).
- Chủ khoá bấm **Xuất bản** (có thể hẹn giờ); biên tập viên bấm **Gửi duyệt**.
- **Lịch sử**: xem lại từng revision và khôi phục (bản nháp hiện tại được tự lưu thành revision trước khi khôi phục).

## Nhập từ Docusaurus / Mintlify

Trong Studio, nút **Nhập** (biểu tượng cạnh "Nhóm") ở đầu cây nội dung. Chọn file `.zip` của cả dự án (hoặc thư mục
`docs/`), chọn cả thư mục, hoặc vài file `.md`/`.mdx` kèm ảnh; bấm **Xem trước** để xem cây bài và cảnh báo rồi mới **Nhập**.
API: `POST /api/v1/versions/:versionId/import` (multipart, field `files`; `dryRun`, `publish`, `format`, `categoryLabel`).

- **Docusaurus**: thư mục `docs/` thành nhóm bài; thứ tự theo `_category_.json`, `sidebar_position`, tiền tố số
  (`01-intro.md`). Không đọc `sidebars.js`/`docusaurus.config.js` (là code JavaScript). Admonition (kể cả `:::tip Tiêu đề`
  kiểu cũ, `caution`→warning), `<Tabs>/<TabItem>`, `<details>`, `<Admonition>`, `<CodeBlock>`, comment `// highlight-*`,
  partial `import X from './_x.mdx'` được chuyển. Ảnh `/img/...` lấy từ `static/`.
- **Mintlify**: cây theo `navigation` của `docs.json` (hoặc `mint.json` cũ); trang không có trong navigation và trang
  OpenAPI bị bỏ qua (có trong báo cáo). `<Note>`/`<Tip>`/`<Warning>`/`<Check>`, `<Steps>`, `<Accordion>`, `<CardGroup>`/`<Columns>`
  + `<Card>`, `<CodeGroup>`, `<Tabs>`, `<Frame>`, `<Tooltip>`, `<Badge>`, `<Icon>`, `<Tree>` và snippet `/snippets/*.mdx` được chuyển.
- Link giữa các bài được đổi sang bài mới; ảnh PNG/JPEG/GIF/WebP/AVIF được tải lên S3 (SVG không nhận).
  `import`/`export` và biểu thức `{...}` bị bỏ — không chạy JavaScript của file nhập. Component không hỗ trợ được bỏ thẻ,
  giữ nội dung, có cảnh báo kèm số dòng. File không phải MDX hợp lệ (ví dụ có `<br>`) được nhập như Markdown thường.
- Bài nhập là bản nháp; chủ khoá có thể chọn **Xuất bản luôn**. Giới hạn: 50 MB mỗi lần, 1.000 bài, 300 MB sau giải nén.

## Theme giao diện

10 theme đặt tên theo bộ theme của Mintlify: DocsHub (mặc định), Mint, Maple, Palm, Willow, Linden, Almond, Aspen,
Sequoia, Luma. Mỗi theme đổi bảng màu sáng/tối, font và độ bo góc; bố cục giữ nguyên. Màu là của DocsHub (lấy cảm hứng,
không sao chép), mọi cặp chữ/nền đạt tương phản WCAG AA.

- **Chủ khoá**: Studio → Cài đặt → **Giao diện** chọn theme và màu chính riêng (#rrggbb, giống `colors.primary` của
  Mintlify). Màu riêng được tự chỉnh độ sáng để chữ và nút luôn đủ tương phản. Áp cho trang đọc, Studio, cài đặt, thống kê
  của khoá đó.
- **Mỗi người dùng**: menu giao diện (biểu tượng mặt trời/mặt trăng) → **Theme màu**. Chọn một theme thì đè theme của mọi
  khoá học; "Theo khoá học" để quay về theme khoá. Lưu trong tài khoản (`PATCH /users/me {theme}`), chép ra cookie
  `docshub_theme` khi đăng nhập để trang hiển thị đúng ngay từ lần tải đầu.
- Định nghĩa theme: `apps/web/src/lib/themes.ts` (danh sách id phải khớp `apps/api/src/common/themes.ts`).

## Cài đặt khoá học

Chủ khoá vào **Studio → Cài đặt** (`/studio/<slug>/settings`): sửa thông tin, lưu trữ khoá; thêm thành viên, ghi danh học viên
hàng loạt bằng email; tạo lớp và gán phiên bản cho lớp; tạo phiên bản mới (sao chép từ bản cũ), đặt hiện hành, khoá, xoá.

## Ảnh (S3)

- Dev dùng [RustFS](https://github.com/rustfs/rustfs) trong docker-compose (MinIO đã ngừng phát hành image công khai).
  Giao diện quản trị: http://localhost:9001 (`docshub` / `docshub-dev-secret`). API tự tạo bucket và CORS khi chạy ở dev.
- Production dùng AWS S3: bỏ trống `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=false`, tự cấu hình bucket riêng tư và CORS
  cho phép `PUT`/`GET` từ tên miền web.
- Trong editor: dán, kéo-thả hoặc bấm nút ảnh. Trình duyệt tải thẳng lên S3 bằng URL đã ký; Markdown lưu đường dẫn cố định
  `/api/v1/assets/<id>`, mỗi lần xem API kiểm tra quyền rồi chuyển hướng tới URL ký mới (hết hạn sau 1 giờ).
- Nhận PNG, JPEG, GIF, WebP, AVIF tối đa 10 MB. Không nhận SVG vì có thể chứa script.

## Tìm kiếm (Meilisearch)

- Trang đọc: ô **Tìm trong khoá học** hoặc **Ctrl/⌘+K**. Tìm được cả khi gõ không dấu ("cai dat" ra "Cài đặt");
  kết quả là từng mục h2/h3 của bài, Enter mở đúng mục đó.
- Chỉ lập chỉ mục bài đã xuất bản. API tự lập lại chỉ mục của version khi xuất bản, gỡ, sắp xếp, đổi slug, xoá bài;
  bài hẹn giờ chỉ hiện trong kết quả khi tới giờ. Lần đầu chạy với index trống thì tự lập toàn bộ.
- Lệch dữ liệu (ví dụ đã xoá index bằng tay): **Quản trị → Hệ thống → Lập lại chỉ mục tìm kiếm**
  (hoặc `POST /api/v1/admin/search/reindex`).

## Tiến độ học, bookmark, ghi chú

- Bài tự được tính **hoàn thành** khi học viên cuộn ≥ 90% và đọc ≥ 30 giây (chỉ tính lúc tab đang mở);
  hoặc bấm **Đánh dấu hoàn thành** cuối bài. Sidebar có dấu ✓ và thanh % tiến độ; trang chủ có nút **Đọc tiếp**.
- **Lưu bài** ở đầu bài, hoặc biểu tượng bookmark cạnh từng mục trong "Trên trang này".
- **Ghi chú**: bôi đen một đoạn trong bài rồi bấm nút **Ghi chú** hiện ra, hoặc nút Ghi chú ở đầu bài. Ghi chú chỉ người viết xem được.
- Tất cả bookmark và ghi chú: menu tài khoản → **Đã lưu & ghi chú** (`/saved`).
- Cuối bài có "Bài này có hữu ích?"; chọn **Chưa** thì có ô góp ý gửi cho giảng viên.

## Thống kê

Chủ khoá vào **Studio → Thống kê** (`/studio/<slug>/analytics`), lọc 7/30/90 ngày và phiên bản. Chỉ tính học viên
(giảng viên xem thử không làm lệch số). Có học viên hoạt động theo ngày, tỉ lệ hoàn thành từng bài, phân bố tiến độ,
bảng chi tiết (xuất CSV) và các từ khoá tìm mà không có kết quả. Mỗi biểu đồ có nút chuyển sang dạng bảng.

## Quản trị hệ thống

Tài khoản `ADMIN` vào **menu tài khoản → Quản trị hệ thống** (`/admin`). Bố cục theo block `dashboard-01` của shadcn/ui
(sidebar thu gọn được, KPI cards, area chart, data table).

- **Tổng quan**: KPI 7/30/90 ngày so với kỳ trước (người dùng, người học hoạt động, lượt đọc, tìm kiếm không ra kết quả),
  biểu đồ theo ngày (giờ Việt Nam), khoá học nổi bật, người dùng mới, phân bố vai trò.
- **Người dùng**: lọc theo vai trò/trạng thái, tìm, sắp xếp, ẩn/hiện cột, xuất CSV; đổi vai trò, khoá/mở khoá từng người
  hoặc hàng loạt. Khoá tài khoản thu hồi mọi phiên đăng nhập. Không tự hạ quyền/tự khoá được, và luôn còn ít nhất 1 admin.
- **Khoá học**: số thành viên, học viên hoạt động, lượt đọc 30 ngày; lưu trữ/khôi phục (hàng loạt), **chuyển chủ khoá**
  (chủ cũ thành biên tập viên), xoá vĩnh viễn (phải gõ lại slug).
- **Cài đặt** (lưu trong bảng `system_settings`, chỉ giữ phần khác mặc định, API đọc lại sau tối đa 30 giây):
  - Chung: tên site, khẩu hiệu, email hỗ trợ.
  - Đăng nhập: cho phép đăng ký, đăng nhập Google, giới hạn tên miền email, vai trò mặc định của tài khoản mới.
  - Giao diện: theme và màu chính mặc định của hệ thống (khoá học "Theo mặc định hệ thống" và người chưa chọn theme dùng theme này).
  - Nội dung: dung lượng ảnh tối đa (≤ 10 MB), bật/tắt import, số bài tối đa mỗi lần import.
  - Học tập: ngưỡng tự hoàn thành bài (% cuộn, số giây đọc).
  - Thông báo: thanh thông báo trên mọi trang (info/warning/danger), người đọc tắt được.
  - Bảo trì: người không phải admin nhận 503 và được chuyển tới `/maintenance`; đăng nhập vẫn mở để admin vào tắt.
- **Hệ thống**: tình trạng API, PostgreSQL, Meilisearch, S3 cùng số bản ghi; lập lại chỉ mục tìm kiếm.
- **Nhật ký**: ai đổi cấu hình, vai trò, khoá tài khoản, lưu trữ/xoá/chuyển chủ khoá học, lập lại chỉ mục và lúc nào
  (bảng `audit_logs`).

API: `GET /admin/overview?days=`, `GET /admin/courses`, `PATCH /admin/courses/:id/owner`, `GET /admin/system`,
`GET /admin/audit`, `GET|PATCH /admin/settings`, `GET /settings/public`.

## Web gọi API thế nào

Trình duyệt chỉ nói chuyện với Next.js (backend-for-frontend). Next.js giữ access token và
refresh token trong cookie httpOnly của chính nó (`docshub_at`, `docshub_rt`), gọi NestJS
từ phía server, và `src/proxy.ts` tự refresh khi access token sắp hết hạn. Client Component
cần gọi API thì đi qua `/api/v1/*` của web, route này gắn token rồi chuyển tiếp.

## Phân quyền

- Hệ thống: `ADMIN` (vận hành), `INSTRUCTOR` (được tạo khoá học), `USER`.
  Admin đổi vai trò ở **Quản trị → Người dùng** (`PATCH /api/v1/users/:id`).
- Khoá học: `OWNER` (xuất bản, quản lý thành viên/version), `EDITOR` (soạn, gửi duyệt), `LEARNER` (đọc bài đã xuất bản).

## Cú pháp Markdown hỗ trợ

GFM, frontmatter YAML, KaTeX (`$...$`, `$$...$$`), Mermaid (` ```mermaid `), và:

````md
:::tip[Tiêu đề tuỳ chọn]
note | tip | info | warning | danger
:::

::::tabs
:::tab{label="npm"}
npm i @nestjs/core
:::
:::tab{label="pnpm"}
pnpm add @nestjs/core
:::
::::

::youtube{id="dQw4w9WgXcQ"}

```ts title="app.module.ts" {2,4-6} showLineNumbers
const a = 1;
```

[Bài khác](./02-provider.md)
````

### Thành phần kiểu Mintlify

Viết bằng directive thay cho MDX (không chạy JSX của tác giả). Icon là tên icon
[lucide](https://lucide.dev/icons). Trong Studio: menu **Thành phần** trên toolbar hoặc gõ `/steps`, `/cards`,
`/codegroup`, `/accordion`, `/frame`, `/tree`, `/badge`, `/tooltip`, `/icon`, `/check`.

````md
:::check{icon="party-popper"}
Callout "thành công"; mọi callout nhận icon tuỳ chọn.
:::

::::steps
:::step[Cài Nest CLI]{icon="terminal"}
npm i -g @nestjs/cli
:::
:::step[Tạo dự án]
nest new my-app
:::
::::

::::accordion-group
:::accordion[Vì sao dùng DI?]{open}
Vì dễ test.
:::
::::

:::expandable[Thuộc tính]
Phần "xem thêm" gọn hơn accordion.
:::

::::columns{cols=2}
:::card[Module]{icon="boxes" href="./module.md" cta="Đọc bài" type="tip"}
Thẻ có link: cả thẻ bấm được, link nội bộ được kiểm tra như link thường.
:::
::card[Thẻ không nội dung]{icon="rocket" horizontal}
::::

::::code-group
```bash title="npm"
npm i @nestjs/core
```
```bash title="pnpm"
pnpm add @nestjs/core
```
::::

```ts lines wrap
return 'Hello'; // [!code --]
return 'Xin chào'; // [!code ++]
ping(); // [!code focus]
```

```tree
src/
  app.module.ts   # module gốc
  users/
    users.service.ts
```

:::frame[Chú thích ảnh]
![Sơ đồ](./assets/so-do.webp)
:::

:badge[Mới]{color="green"} :icon{name="star"} :tooltip[DI]{tip="Dependency Injection"}
````

Chú thích trong code còn có `[!code highlight]`, `[!code error]`, `[!code warning]`. Badge có 7 màu: gray, blue, green,
yellow, orange, red, purple. Directive sai tên hoặc thiếu thuộc tính bắt buộc được giữ nguyên dạng chữ.
