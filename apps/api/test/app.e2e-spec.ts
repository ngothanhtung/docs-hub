import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { zipSync } from 'fflate';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

/**
 * Luồng chính của MVP trên database thật (`pnpm test:e2e` tự reset DB docshub_test).
 * Các bước chạy nối tiếp và dùng chung trạng thái, như một buổi làm việc thật.
 */
describe('DocsHub API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const tokens: Record<'admin' | 'owner' | 'editor' | 'learner' | 'outsider', string> = {
    admin: '',
    owner: '',
    editor: '',
    learner: '',
    outsider: '',
  };
  let ownerId = '';
  let courseId = '';
  let versionId = '';
  let categoryId = '';
  let moduleDocId = '';
  let providerDocId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await resetTestDatabase(prisma);

    await prisma.user.create({
      data: {
        email: 'admin@test.vn',
        name: 'Admin',
        systemRole: 'ADMIN',
        passwordHash: await argon2.hash('Admin@123456'),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('xác thực', () => {
    it('đăng ký 4 tài khoản và đăng nhập admin', async () => {
      for (const name of ['owner', 'editor', 'learner', 'outsider'] as const) {
        const res = await api()
          .post('/api/v1/auth/register')
          .send({ email: ` ${name.toUpperCase()}@test.vn `, password: 'Matkhau@123', name })
          .expect(201);
        expect(res.body.user).toMatchObject({ email: `${name}@test.vn`, systemRole: 'USER' });
        expect(res.body.user.passwordHash).toBeUndefined();
        expect(res.headers['set-cookie'][0]).toMatch(/docshub_rt=.+HttpOnly/);
        tokens[name] = res.body.accessToken;
        if (name === 'owner') ownerId = res.body.user.id;
      }
      const admin = await api()
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.vn', password: 'Admin@123456' })
        .expect(200);
      tokens.admin = admin.body.accessToken;
    });

    it('từ chối email trùng, mật khẩu sai và route không có token', async () => {
      await api()
        .post('/api/v1/auth/register')
        .send({ email: 'owner@test.vn', password: 'Matkhau@123', name: 'x' })
        .expect(409);
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: 'owner@test.vn', password: 'sai-mat-khau' })
        .expect(401);
      expect(res.body.message).toBe('Email hoặc mật khẩu không đúng');
      await api().get('/api/v1/courses').expect(401);
    });

    it('chỉ admin mới đổi được vai trò hệ thống', async () => {
      await api()
        .patch(`/api/v1/users/${ownerId}`)
        .set(auth(tokens.owner))
        .send({ systemRole: 'INSTRUCTOR' })
        .expect(403);
      await api()
        .patch(`/api/v1/users/${ownerId}`)
        .set(auth(tokens.admin))
        .send({ systemRole: 'INSTRUCTOR' })
        .expect(200);
      // Vai trò nằm trong access token: đăng nhập lại để lấy token mới.
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: 'owner@test.vn', password: 'Matkhau@123' })
        .expect(200);
      tokens.owner = res.body.accessToken;
      expect(res.body.user.systemRole).toBe('INSTRUCTOR');
    });
  });

  describe('khoá học và thành viên', () => {
    it('học viên thường không tạo được khoá, giảng viên thì được', async () => {
      await api()
        .post('/api/v1/courses')
        .set(auth(tokens.learner))
        .send({ title: 'Khoá lậu' })
        .expect(403);
      const res = await api()
        .post('/api/v1/courses')
        .set(auth(tokens.owner))
        .send({ title: 'Lập trình NestJS cơ bản', versionLabel: '2026' })
        .expect(201);
      expect(res.body.slug).toBe('lap-trinh-nestjs-co-ban');
      expect(res.body.versions).toEqual([
        expect.objectContaining({ slug: '2026', isCurrent: true }),
      ]);
      courseId = res.body.id;
      versionId = res.body.versions[0].id;
    });

    it('thêm biên tập viên, ghi danh học viên hàng loạt', async () => {
      await api()
        .post(`/api/v1/courses/${courseId}/members`)
        .set(auth(tokens.owner))
        .send({ email: 'editor@test.vn', role: 'EDITOR' })
        .expect(201);
      const res = await api()
        .post(`/api/v1/courses/${courseId}/members/enroll`)
        .set(auth(tokens.owner))
        .send({ emails: ['learner@test.vn', 'EDITOR@test.vn', 'chuaco@test.vn'] })
        .expect(200);
      expect(res.body).toEqual({
        enrolled: ['learner@test.vn'],
        alreadyMembers: ['editor@test.vn'],
        notFound: ['chuaco@test.vn'],
      });
    });

    it('người ngoài khoá nhận 404, học viên thấy khoá theo slug', async () => {
      await api()
        .get('/api/v1/courses/lap-trinh-nestjs-co-ban')
        .set(auth(tokens.outsider))
        .expect(404);
      const res = await api()
        .get('/api/v1/courses/lap-trinh-nestjs-co-ban')
        .set(auth(tokens.learner))
        .expect(200);
      expect(res.body.role).toBe('LEARNER');
      const list = await api().get('/api/v1/courses').set(auth(tokens.outsider)).expect(200);
      expect(list.body).toEqual([]);
    });
  });

  describe('soạn và xuất bản', () => {
    it('tạo nhóm bài và hai bài viết', async () => {
      const category = await api()
        .post(`/api/v1/versions/${versionId}/categories`)
        .set(auth(tokens.editor))
        .send({ label: 'Kiến trúc', icon: 'layers' })
        .expect(201);
      expect(category.body.slug).toBe('kien-truc');
      categoryId = category.body.id;

      const moduleDoc = await api()
        .post(`/api/v1/versions/${versionId}/docs`)
        .set(auth(tokens.editor))
        .send({ title: 'Module', categoryId })
        .expect(201);
      moduleDocId = moduleDoc.body.id;

      const provider = await api()
        .post(`/api/v1/versions/${versionId}/docs`)
        .set(auth(tokens.editor))
        .send({ title: 'Provider và DI', categoryId })
        .expect(201);
      expect(provider.body).toMatchObject({ slug: 'provider-va-di', position: 1, status: 'DRAFT' });
      providerDocId = provider.body.id;

      await api()
        .post(`/api/v1/versions/${versionId}/docs`)
        .set(auth(tokens.learner))
        .send({ title: 'Không được' })
        .expect(403);
    });

    it('autosave đồng bộ title và slug từ frontmatter, không tạo revision', async () => {
      const source = [
        '---',
        'title: Provider và Dependency Injection',
        'slug: provider',
        '---',
        '',
        ':::tip[Ghi nhớ]',
        'Provider được tiêm qua constructor.',
        ':::',
        '',
        'Xem lại [Module](./01-module.md).',
        '',
        '```ts title="cats.service.ts"',
        '@Injectable()',
        'export class CatsService {}',
        '```',
      ].join('\n');
      const res = await api()
        .put(`/api/v1/docs/${providerDocId}/draft`)
        .set(auth(tokens.editor))
        .send({ source })
        .expect(200);
      expect(res.body.doc).toMatchObject({ title: 'Provider và Dependency Injection', slug: 'provider' });
      expect(res.body.revision).toBeNull();
    });

    it('báo lỗi frontmatter kèm số dòng', async () => {
      const res = await api()
        .put(`/api/v1/docs/${providerDocId}/draft`)
        .set(auth(tokens.editor))
        .send({ source: '---\ntitle: [lỗi\n---\n' })
        .expect(400);
      expect(res.body).toMatchObject({ error: 'FrontmatterError', line: 2 });
    });

    it('chặn ghi đè khi người khác vừa lưu', async () => {
      const stale = new Date(Date.now() - 60_000).toISOString();
      const res = await api()
        .put(`/api/v1/docs/${providerDocId}/draft`)
        .set(auth(tokens.owner))
        .send({ source: 'ghi đè', baseUpdatedAt: stale })
        .expect(409);
      expect(res.body.message).toContain('người khác cập nhật');
    });

    it('preview render đúng pipeline và đổi link nội bộ', async () => {
      const res = await api()
        .post('/api/v1/render/preview')
        .set(auth(tokens.editor))
        .send({ versionId, source: '[Module](./01-module.md) [hỏng](./khong-co.md)' })
        .expect(200);
      expect(res.body.html).toContain(
        'href="/courses/lap-trinh-nestjs-co-ban/2026/kien-truc/module"',
      );
      expect(res.body.warnings).toEqual([
        expect.objectContaining({ rule: 'broken-link', line: 1 }),
      ]);
    });

    it('biên tập viên không xuất bản được, chỉ gửi duyệt', async () => {
      await api()
        .post(`/api/v1/docs/${providerDocId}/publish`)
        .set(auth(tokens.editor))
        .send({})
        .expect(403);
      const res = await api()
        .post(`/api/v1/docs/${providerDocId}/submit`)
        .set(auth(tokens.editor))
        .expect(200);
      expect(res.body.doc.status).toBe('IN_REVIEW');
      expect(res.body.revision.number).toBe(1);
    });

    it('chủ khoá xuất bản: dùng lại revision vừa gửi duyệt', async () => {
      const res = await api()
        .post(`/api/v1/docs/${providerDocId}/publish`)
        .set(auth(tokens.owner))
        .send({ message: 'Bản đầu tiên' })
        .expect(200);
      expect(res.body.doc.status).toBe('PUBLISHED');
      expect(res.body.revision.number).toBe(1);
      await api()
        .post(`/api/v1/docs/${moduleDocId}/publish`)
        .set(auth(tokens.owner))
        .send({})
        .expect(200);
    });
  });

  describe('học viên đọc bài', () => {
    it('sidebar chỉ có bài đã xuất bản', async () => {
      await api().post(`/api/v1/versions/${versionId}/docs`).set(auth(tokens.owner))
        .send({ title: 'Bản nháp bí mật' }).expect(201);
      const res = await api()
        .get('/api/v1/read/lap-trinh-nestjs-co-ban/tree')
        .set(auth(tokens.learner))
        .expect(200);
      expect(res.body.version.slug).toBe('2026');
      expect(res.body.tree).toEqual([
        expect.objectContaining({
          type: 'category',
          path: 'kien-truc',
          children: [
            expect.objectContaining({ path: 'kien-truc/module', label: 'Module' }),
            expect.objectContaining({ path: 'kien-truc/provider', label: 'Provider và Dependency Injection' }),
          ],
        }),
      ]);
    });

    it('trang bài có HTML đã render, mục lục, prev/next, breadcrumb', async () => {
      const res = await api()
        .get('/api/v1/read/lap-trinh-nestjs-co-ban/page')
        .query({ path: 'kien-truc/provider' })
        .set(auth(tokens.learner))
        .expect(200);
      expect(res.body.type).toBe('doc');
      expect(res.body.doc.html).toContain('<div class="admonition-heading">Ghi nhớ</div>');
      expect(res.body.doc.html).toContain('href="/courses/lap-trinh-nestjs-co-ban/2026/kien-truc/module"');
      expect(res.body.doc.html).toContain('<div class="code-block-title">cats.service.ts</div>');
      expect(res.body.breadcrumb).toEqual([{ label: 'Kiến trúc', path: 'kien-truc' }]);
      expect(res.body.prev).toEqual({ label: 'Module', path: 'kien-truc/module' });
      expect(res.body.next).toBeNull();
    });

    it('học viên không vào được Studio; bài sửa sau xuất bản chưa hiện cho học viên', async () => {
      await api().get(`/api/v1/docs/${providerDocId}`).set(auth(tokens.learner)).expect(403);

      await api()
        .put(`/api/v1/docs/${providerDocId}/draft`)
        .set(auth(tokens.owner))
        .send({ source: '---\ntitle: Provider\nslug: provider\n---\n\nNội dung mới chưa duyệt.' })
        .expect(200);
      const studio = await api().get(`/api/v1/docs/${providerDocId}`).set(auth(tokens.owner)).expect(200);
      expect(studio.body).toMatchObject({ status: 'DRAFT', hasUnpublishedChanges: true });

      const page = await api()
        .get('/api/v1/read/lap-trinh-nestjs-co-ban/page')
        .query({ path: 'kien-truc/provider' })
        .set(auth(tokens.learner))
        .expect(200);
      expect(page.body.doc.html).not.toContain('Nội dung mới chưa duyệt');
    });

    it('bài hẹn giờ chưa tới giờ thì ẩn', async () => {
      await api()
        .post(`/api/v1/docs/${moduleDocId}/publish`)
        .set(auth(tokens.owner))
        .send({ publishAt: new Date(Date.now() + 86_400_000).toISOString() })
        .expect(200);
      await api()
        .get('/api/v1/read/lap-trinh-nestjs-co-ban/page')
        .query({ path: 'kien-truc/module' })
        .set(auth(tokens.learner))
        .expect(404);
      await api().post(`/api/v1/docs/${moduleDocId}/publish`).set(auth(tokens.owner)).send({}).expect(200);
    });
  });

  describe('tìm kiếm, tiến độ học, thống kê', () => {
    const slug = 'lap-trinh-nestjs-co-ban';

    /** Chỉ mục được cập nhật bất đồng bộ sau khi xuất bản: chờ tới khi có kết quả. */
    async function searchUntil(q: string, expectHits: boolean) {
      for (let i = 0; i < 30; i += 1) {
        const res = await api().get(`/api/v1/read/${slug}/search`).query({ q }).set(auth(tokens.learner)).expect(200);
        if ((res.body.hits.length > 0) === expectHits) return res.body;
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error(`Hết thời gian chờ kết quả tìm kiếm cho "${q}"`);
    }

    it('tìm theo nội dung, trả về đúng mục và tô sáng từ khoá đã thoát HTML', async () => {
      const body = await searchUntil('constructor', true);
      expect(body.hits[0]).toMatchObject({ path: 'kien-truc/provider', title: 'Provider và Dependency Injection' });
      expect(body.hits[0].snippet).toContain('<mark>constructor</mark>');
      expect(body.hits[0].snippet).not.toMatch(/<(?!\/?mark>)/);

      const accentless = await searchUntil('ghi nho', true);
      expect(accentless.hits[0].path).toBe('kien-truc/provider');
    });

    it('từ khoá không có kết quả được ghi lại; người ngoài khoá không tìm được', async () => {
      const body = await searchUntil('xyzkhongtontai', false);
      expect(body.hits).toEqual([]);
      await api().get(`/api/v1/read/${slug}/search`).query({ q: 'provider' }).set(auth(tokens.outsider)).expect(404);
    });

    it('tự đánh dấu đã đọc khi cuộn ≥ 90% và đọc ≥ 30 giây', async () => {
      const first = await api()
        .put(`/api/v1/progress/${providerDocId}`)
        .set(auth(tokens.learner))
        .send({ scrollPct: 95, secondsDelta: 20 })
        .expect(200);
      expect(first.body.completed).toBe(false);
      const second = await api()
        .put(`/api/v1/progress/${providerDocId}`)
        .set(auth(tokens.learner))
        .send({ scrollPct: 40, secondsDelta: 15 })
        .expect(200);
      expect(second.body).toMatchObject({ completed: true, scrollPct: 95, timeSpentSec: 35 });

      const progress = await api().get('/api/v1/me/progress').query({ course: slug }).set(auth(tokens.learner)).expect(200);
      expect(progress.body).toMatchObject({ total: 2, completedDocIds: [providerDocId], percent: 50 });
      expect(progress.body.lastDoc.path).toBe('kien-truc/provider');

      await api().post(`/api/v1/progress/${moduleDocId}/complete`).set(auth(tokens.learner)).send({ completed: true }).expect(200);
      const summary = await api().get('/api/v1/me/progress/summary').set(auth(tokens.learner)).expect(200);
      expect(summary.body).toEqual([expect.objectContaining({ courseId, percent: 100, completed: 2, total: 2 })]);
    });

    it('bookmark, ghi chú và đánh giá bài; trang bài trả về trạng thái của chính học viên', async () => {
      await api()
        .post('/api/v1/me/bookmarks')
        .set(auth(tokens.learner))
        .send({ docId: providerDocId, anchor: 'tạo-provider', label: 'Tạo provider' })
        .expect(201);
      const note = await api()
        .post('/api/v1/me/notes')
        .set(auth(tokens.learner))
        .send({ docId: providerDocId, quote: 'tiêm qua constructor', content: 'Nhớ hỏi thầy về scope' })
        .expect(201);
      await api().patch(`/api/v1/me/notes/${note.body.id}`).set(auth(tokens.editor)).send({ content: 'x' }).expect(403);
      await api().put(`/api/v1/docs/${providerDocId}/feedback`).set(auth(tokens.learner)).send({ helpful: true }).expect(200);

      const notes = await api().get('/api/v1/me/notes').query({ course: slug }).set(auth(tokens.learner)).expect(200);
      expect(notes.body[0]).toMatchObject({
        content: 'Nhớ hỏi thầy về scope',
        doc: { title: 'Provider và Dependency Injection', path: 'kien-truc/provider', courseSlug: slug },
      });

      const page = await api()
        .get(`/api/v1/read/${slug}/page`)
        .query({ path: 'kien-truc/provider' })
        .set(auth(tokens.learner))
        .expect(200);
      expect(page.body.me).toMatchObject({
        completed: true,
        bookmarks: [expect.objectContaining({ anchor: 'tạo-provider' })],
        feedback: { helpful: true, comment: null },
      });
    });

    it('chủ khoá xem thống kê; biên tập viên thì không', async () => {
      const res = await api().get(`/api/v1/analytics/courses/${courseId}`).query({ days: 7 }).set(auth(tokens.owner)).expect(200);
      expect(res.body.overview).toMatchObject({ learners: 1, activeLearners: 1, publishedDocs: 2, avgCompletion: 100 });
      expect(res.body.daily).toHaveLength(7);
      expect(res.body.daily.at(-1).activeLearners).toBe(1);
      expect(res.body.docs.find((d: { path: string }) => d.path === 'kien-truc/provider')).toMatchObject({
        completed: 1,
        completionRate: 100,
        avgTimeSec: 35,
        helpful: 1,
      });
      expect(res.body.distribution.find((b: { label: string }) => b.label === '100%').learners).toBe(1);
      // Lần tìm "xyzkhongtontai" chắc chắn không có kết quả; các lần tìm khi chỉ mục chưa kịp cập nhật cũng được tính.
      expect(res.body.searchMisses).toContainEqual({ query: 'xyzkhongtontai', count: expect.any(Number) });

      await api().get(`/api/v1/analytics/courses/${courseId}`).set(auth(tokens.editor)).expect(403);
    });
  });

  describe('lịch sử và cấu trúc', () => {
    it('lưu tạo revision mới, khôi phục bản cũ thành revision tiếp theo', async () => {
      await api()
        .put(`/api/v1/docs/${providerDocId}/draft`)
        .set(auth(tokens.owner))
        .send({ source: '---\ntitle: Provider\nslug: provider\n---\n\nBản 2.', createRevision: true })
        .expect(200);
      const restored = await api()
        .post(`/api/v1/docs/${providerDocId}/revisions/1/restore`)
        .set(auth(tokens.owner))
        .expect(200);
      expect(restored.body.revision.number).toBe(3);
      const list = await api().get(`/api/v1/docs/${providerDocId}/revisions`).set(auth(tokens.owner)).expect(200);
      expect(list.body.map((r: { number: number }) => r.number)).toEqual([3, 2, 1]);
      expect(list.body.find((r: { number: number }) => r.number === 1).isPublished).toBe(true);
      expect(list.body[0].message).toBe('Khôi phục từ bản #1');
    });

    it('kéo-thả: chặn vòng lặp, đưa bài ra gốc', async () => {
      const child = await api()
        .post(`/api/v1/versions/${versionId}/categories`)
        .set(auth(tokens.owner))
        .send({ label: 'Nâng cao', parentId: categoryId })
        .expect(201);
      await api()
        .patch(`/api/v1/versions/${versionId}/tree`)
        .set(auth(tokens.owner))
        .send({ categories: [{ id: categoryId, parentId: child.body.id, position: 0 }] })
        .expect(400);
      const res = await api()
        .patch(`/api/v1/versions/${versionId}/tree`)
        .set(auth(tokens.owner))
        .send({ docs: [{ id: moduleDocId, categoryId: null, position: 0 }] })
        .expect(200);
      expect(res.body).toContainEqual(
        expect.objectContaining({ type: 'doc', id: moduleDocId, path: 'module' }),
      );
    });

    it('cắt version mới mang theo bài đã xuất bản', async () => {
      const res = await api()
        .post(`/api/v1/courses/${courseId}/versions`)
        .set(auth(tokens.owner))
        .send({ label: '2027', copyFromVersionId: versionId, makeCurrent: true })
        .expect(201);
      expect(res.body).toMatchObject({ slug: '2027', isCurrent: true });

      const tree = await api()
        .get('/api/v1/read/lap-trinh-nestjs-co-ban/tree')
        .set(auth(tokens.learner))
        .expect(200);
      expect(tree.body.version.slug).toBe('2027');
      expect(tree.body.versions.map((v: { slug: string }) => v.slug)).toEqual(['2027', '2026']);
      const paths = JSON.stringify(tree.body.tree);
      expect(paths).toContain('"path":"module"');
      expect(paths).toContain('"path":"kien-truc/provider"');

      const old = await api()
        .get('/api/v1/read/lap-trinh-nestjs-co-ban/page')
        .query({ path: 'kien-truc/provider', version: '2026' })
        .set(auth(tokens.learner))
        .expect(200);
      expect(old.body.version.slug).toBe('2026');
    });
  });

  describe('ảnh (S3)', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let assetId = '';

    it('biên tập viên tải ảnh thẳng lên S3 bằng URL đã ký rồi xác nhận', async () => {
      const created = await api()
        .post(`/api/v1/courses/${courseId}/assets`)
        .set(auth(tokens.editor))
        .send({ filename: 'so-do.png', contentType: 'image/png', size: png.byteLength })
        .expect(201);
      assetId = created.body.asset.id;
      expect(created.body.asset.url).toBe(`/api/v1/assets/${assetId}`);

      await api().post(`/api/v1/assets/${assetId}/complete`).set(auth(tokens.editor)).expect(400);

      const put = await fetch(created.body.upload.url, {
        method: 'PUT',
        headers: created.body.upload.headers,
        body: png,
      });
      expect(put.status).toBe(200);

      const done = await api().post(`/api/v1/assets/${assetId}/complete`).set(auth(tokens.editor)).expect(200);
      expect(done.body.uploadedAt).toBeTruthy();
    });

    it('học viên xem được ảnh qua redirect, người ngoài khoá thì không', async () => {
      const res = await api().get(`/api/v1/assets/${assetId}`).set(auth(tokens.learner)).expect(302);
      expect(res.headers['cache-control']).toMatch(/^private/);
      const file = await fetch(res.headers.location);
      expect(file.status).toBe(200);
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(png);

      await api().get(`/api/v1/assets/${assetId}`).set(auth(tokens.outsider)).expect(404);
    });

    it('học viên không upload được; SVG và ảnh quá 10 MB bị từ chối', async () => {
      const body = { filename: 'a.png', contentType: 'image/png', size: 10 };
      await api().post(`/api/v1/courses/${courseId}/assets`).set(auth(tokens.learner)).send(body).expect(403);
      await api()
        .post(`/api/v1/courses/${courseId}/assets`)
        .set(auth(tokens.editor))
        .send({ ...body, contentType: 'image/svg+xml' })
        .expect(400);
      await api()
        .post(`/api/v1/courses/${courseId}/assets`)
        .set(auth(tokens.editor))
        .send({ ...body, size: 11 * 1024 * 1024 })
        .expect(400);
    });

    it('danh sách ảnh của khoá chỉ gồm ảnh đã tải xong', async () => {
      const res = await api().get(`/api/v1/courses/${courseId}/assets`).set(auth(tokens.editor)).expect(200);
      expect(res.body.map((a: { id: string }) => a.id)).toEqual([assetId]);
    });
  });

  describe('nhập tài liệu Docusaurus/Mintlify', () => {
    const enc = (text: string) => new TextEncoder().encode(text);
    // PNG 1x1 hợp lệ.
    const png = Uint8Array.from(
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    );
    const docusaurusZip = () =>
      Buffer.from(
        zipSync({
          'site/docusaurus.config.ts': enc('export default {}'),
          'site/docs/intro.md': enc('---\nsidebar_position: 1\n---\n\n# Mở đầu\n\n:::caution Chú ý\nĐọc [cài đặt](./co-ban/02-cai-dat.mdx).\n:::\n\n![Logo](/img/logo.png)\n'),
          'site/docs/co-ban/_category_.json': enc('{"label":"Cơ bản","position":2}'),
          'site/docs/co-ban/02-cai-dat.mdx': enc("import Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\n\n# Cài đặt\n\n<Tabs>\n<TabItem value=\"npm\">\n\nnpm i\n\n</TabItem>\n</Tabs>\n"),
          'site/static/img/logo.png': png,
          '../ngoai.md': enc('# Không được đọc'),
        }),
      );
    const docCount = () => prisma.doc.count({ where: { versionId } });

    it('xem trước (dryRun) trả báo cáo, không ghi gì', async () => {
      const before = await docCount();
      const res = await api()
        .post(`/api/v1/versions/${versionId}/import`)
        .set(auth(tokens.editor))
        .field('dryRun', 'true')
        .attach('files', docusaurusZip(), 'docs.zip')
        .expect(200);
      expect(res.body).toMatchObject({
        dryRun: true,
        format: 'docusaurus',
        summary: { categories: 1, docs: 2, images: 1 },
        created: null,
      });
      expect(res.body.tree.map((n: { label: string }) => n.label)).toEqual(['Mở đầu', 'Cơ bản']);
      expect(await docCount()).toBe(before);
    });

    it('biên tập viên không được xuất bản luôn; gói không có bài thì báo lỗi', async () => {
      await api()
        .post(`/api/v1/versions/${versionId}/import`)
        .set(auth(tokens.editor))
        .field('publish', 'true')
        .attach('files', docusaurusZip(), 'docs.zip')
        .expect(403);
      const empty = Buffer.from(zipSync({ 'a.txt': enc('x') }));
      const res = await api()
        .post(`/api/v1/versions/${versionId}/import`)
        .set(auth(tokens.owner))
        .attach('files', empty, 'empty.zip')
        .expect(400);
      expect(res.body.message).toMatch(/Không tìm thấy bài/);
      await api()
        .post(`/api/v1/versions/${versionId}/import`)
        .set(auth(tokens.learner))
        .attach('files', docusaurusZip(), 'docs.zip')
        .expect(403);
    });

    it('chủ khoá nhập vào nhóm mới và xuất bản: ảnh lên S3, link nội bộ dẫn đúng bài', async () => {
      const res = await api()
        .post(`/api/v1/versions/${versionId}/import`)
        .set(auth(tokens.owner))
        .field('publish', 'true')
        .field('categoryLabel', 'Tài liệu nhập')
        .attach('files', docusaurusZip(), 'docs.zip')
        .expect(200);
      expect(res.body.created).toMatchObject({ categories: 2, docs: 2, published: 2 });

      const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
      const version = await prisma.version.findUniqueOrThrow({ where: { id: versionId } });
      const page = await api()
        .get(`/api/v1/read/${course.slug}/page`)
        .query({ path: 'tai-lieu-nhap/intro', version: version.slug })
        .set(auth(tokens.learner))
        .expect(200);
      expect(page.body.doc.html).toContain('admonition-warning');
      expect(page.body.doc.html).toMatch(/src="\/api\/v1\/assets\/[0-9a-f-]+"/);
      expect(page.body.doc.html).toContain(`href="/courses/${course.slug}/`);
      expect(page.body.doc.html).toContain('/tai-lieu-nhap/co-ban/cai-dat"');

      const install = await api()
        .get(`/api/v1/read/${course.slug}/page`)
        .query({ path: 'tai-lieu-nhap/co-ban/cai-dat', version: version.slug })
        .set(auth(tokens.learner))
        .expect(200);
      expect(install.body.doc.html).toContain('class="tabs"');
    });

    it('nhận diện Mintlify từ docs.json; component lạ được giữ nội dung kèm cảnh báo', async () => {
      const zip = Buffer.from(
        zipSync({
          'docs.json': enc(JSON.stringify({ navigation: { groups: [{ group: 'Bắt đầu', pages: ['quickstart'] }] } })),
          'quickstart.mdx': enc('---\ntitle: Bắt đầu nhanh\n---\n\n<Note>Ghi chú</Note>\n\n<Mystery>Giữ lại</Mystery>\n'),
        }),
      );
      const res = await api()
        .post(`/api/v1/versions/${versionId}/import`)
        .set(auth(tokens.editor))
        .field('dryRun', 'true')
        .attach('files', zip, 'mint.zip')
        .expect(200);
      expect(res.body.format).toBe('mintlify');
      expect(res.body.tree[0]).toMatchObject({ type: 'category', label: 'Bắt đầu' });
      expect(res.body.docs[0].warnings[0].message).toMatch(/Mystery/);
    });
  });

  describe('theme giao diện', () => {
    it('chủ khoá đặt theme + màu chính; trang đọc trả về cho học viên', async () => {
      const res = await api()
        .patch(`/api/v1/courses/${courseId}`)
        .set(auth(tokens.owner))
        .send({ theme: 'maple', primaryColor: '#FF6600' })
        .expect(200);
      expect(res.body).toMatchObject({ theme: 'maple', primaryColor: '#ff6600' });

      const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
      const version = await prisma.version.findUniqueOrThrow({ where: { id: versionId } });
      const tree = await api()
        .get(`/api/v1/read/${course.slug}/tree`)
        .query({ version: version.slug })
        .set(auth(tokens.learner))
        .expect(200);
      expect(tree.body.course).toMatchObject({ theme: 'maple', primaryColor: '#ff6600' });
    });

    it('chặn theme lạ, màu không phải #rrggbb (chặn chèn CSS) và người không phải chủ khoá', async () => {
      for (const body of [{ theme: 'hacker' }, { primaryColor: 'red;}body{display:none' }, { primaryColor: '#fff' }]) {
        await api().patch(`/api/v1/courses/${courseId}`).set(auth(tokens.owner)).send(body).expect(400);
      }
      await api().patch(`/api/v1/courses/${courseId}`).set(auth(tokens.editor)).send({ theme: 'mint' }).expect(403);
    });

    it('bỏ theme và màu riêng bằng null', async () => {
      const res = await api()
        .patch(`/api/v1/courses/${courseId}`)
        .set(auth(tokens.owner))
        .send({ theme: null, primaryColor: null })
        .expect(200);
      expect(res.body).toMatchObject({ theme: null, primaryColor: null });
    });

    it('người dùng tự chọn theme, lưu trong tài khoản', async () => {
      await api().patch('/api/v1/users/me').set(auth(tokens.learner)).send({ theme: 'nope' }).expect(400);
      const res = await api().patch('/api/v1/users/me').set(auth(tokens.learner)).send({ theme: 'linden' }).expect(200);
      expect(res.body.theme).toBe('linden');
      const me = await api().get('/api/v1/auth/me').set(auth(tokens.learner)).expect(200);
      expect(me.body.theme).toBe('linden');
      await api().patch('/api/v1/users/me').set(auth(tokens.learner)).send({ theme: null }).expect(200);
    });
  });

  describe('quản trị hệ thống', () => {
    const patchSettings = (body: object, token = tokens.admin) =>
      api().patch('/api/v1/admin/settings').set(auth(token)).send(body);

    it('chỉ admin xem/sửa cấu hình; dữ liệu sai bị từ chối', async () => {
      await api().get('/api/v1/admin/settings').set(auth(tokens.owner)).expect(403);
      const res = await api().get('/api/v1/admin/settings').set(auth(tokens.admin)).expect(200);
      expect(res.body.settings.general.siteName).toBe('DocsHub');
      await patchSettings({ content: { maxImageMb: 50 } }).expect(400);
      await patchSettings({ appearance: { defaultTheme: 'nope' } }).expect(400);
      await patchSettings({ auth: { allowedEmailDomains: ['không hợp lệ'] } }).expect(400);
      await patchSettings({ unknown: { x: 1 } }).expect(400);
    });

    it('cấu hình công khai và giới hạn đăng ký theo tên miền, vai trò mặc định', async () => {
      await patchSettings({
        general: { siteName: '  Học viện Softech  ' },
        auth: { allowedEmailDomains: ['@Softech.VN'], defaultSystemRole: 'INSTRUCTOR' },
        announcement: { enabled: true, message: 'Bảo trì tối nay 22h', tone: 'warning' },
      }).expect(200);
      const pub = await api().get('/api/v1/settings/public').expect(200);
      expect(pub.body).toMatchObject({
        siteName: 'Học viện Softech',
        allowedEmailDomains: ['softech.vn'],
        announcement: { message: 'Bảo trì tối nay 22h', tone: 'warning' },
        maintenance: null,
      });

      const denied = await api()
        .post('/api/v1/auth/register')
        .send({ email: 'ngoai@gmail.com', password: 'Matkhau@123', name: 'Ngoài' })
        .expect(403);
      expect(denied.body.message).toMatch(/@softech\.vn/);
      const ok = await api()
        .post('/api/v1/auth/register')
        .send({ email: 'gv@softech.vn', password: 'Matkhau@123', name: 'Giảng viên' })
        .expect(201);
      expect(ok.body.user.systemRole).toBe('INSTRUCTOR');

      await patchSettings({ auth: { allowSignup: false } }).expect(200);
      await api()
        .post('/api/v1/auth/register')
        .send({ email: 'gv2@softech.vn', password: 'Matkhau@123', name: 'x' })
        .expect(403);
      await patchSettings({ auth: { allowSignup: true, allowedEmailDomains: [], defaultSystemRole: 'USER' } }).expect(200);
    });

    it('giới hạn dung lượng ảnh do admin đặt', async () => {
      await patchSettings({ content: { maxImageMb: 1 } }).expect(200);
      const res = await api()
        .post(`/api/v1/courses/${courseId}/assets`)
        .set(auth(tokens.editor))
        .send({ filename: 'lon.png', contentType: 'image/png', size: 2 * 1024 * 1024 })
        .expect(400);
      expect(res.body.message).toMatch(/1 MB/);
      await patchSettings({ content: { maxImageMb: 10, importEnabled: false } }).expect(200);
      const imported = await api()
        .post(`/api/v1/versions/${versionId}/import`)
        .set(auth(tokens.owner))
        .field('dryRun', 'true')
        .attach('files', Buffer.from('# A'), 'a.md')
        .expect(403);
      expect(imported.body.message).toMatch(/tắt/);
      await patchSettings({ content: { importEnabled: true } }).expect(200);
    });

    it('chế độ bảo trì chặn người dùng thường, admin vẫn làm việc được', async () => {
      await patchSettings({ maintenance: { enabled: true, message: 'Đang nâng cấp' } }).expect(200);
      const blocked = await api().get('/api/v1/courses').set(auth(tokens.learner)).expect(503);
      expect(blocked.body).toMatchObject({ code: 'MAINTENANCE', message: 'Đang nâng cấp' });
      await api().get('/api/v1/courses').set(auth(tokens.admin)).expect(200);
      await api().get('/api/v1/settings/public').expect(200);
      await api().get('/api/v1/health').expect(200);
      await patchSettings({ maintenance: { enabled: false } }).expect(200);
      await api().get('/api/v1/courses').set(auth(tokens.learner)).expect(200);
    });

    it('tổng quan, danh sách khoá học và tình trạng hệ thống', async () => {
      const overview = await api().get('/api/v1/admin/overview').query({ days: 7 }).set(auth(tokens.admin)).expect(200);
      expect(overview.body.daily).toHaveLength(7);
      expect(overview.body.kpis.users.total).toBeGreaterThan(4);
      expect(overview.body.kpis.views.total).toBeGreaterThan(0);
      expect(overview.body.topCourses[0]).toMatchObject({ id: courseId });

      const courses = await api().get('/api/v1/admin/courses').set(auth(tokens.admin)).expect(200);
      const course = courses.body.find((c: { id: string }) => c.id === courseId);
      expect(course).toMatchObject({ owner: { id: ownerId }, learners: 1 });
      expect(course.publishedDocs).toBeGreaterThan(0);

      const system = await api().get('/api/v1/admin/system').set(auth(tokens.admin)).expect(200);
      expect(system.body.database.ok).toBe(true);
      expect(system.body.rows.users).toBeGreaterThan(0);
      await api().get('/api/v1/admin/overview').set(auth(tokens.owner)).expect(403);
    });

    it('không tự hạ quyền admin; đổi vai trò, khoá tài khoản và chuyển chủ khoá được ghi nhật ký', async () => {
      const me = await api().get('/api/v1/auth/me').set(auth(tokens.admin)).expect(200);
      await api().patch(`/api/v1/users/${me.body.id}`).set(auth(tokens.admin)).send({ systemRole: 'USER' }).expect(400);
      await api().patch(`/api/v1/users/${me.body.id}`).set(auth(tokens.admin)).send({ isActive: false }).expect(400);

      const users = await api().get('/api/v1/users').set(auth(tokens.admin)).expect(200);
      const editor = users.body.find((u: { email: string }) => u.email === 'editor@test.vn');
      expect(editor).toHaveProperty('courses');
      await api().patch(`/api/v1/users/${editor.id}`).set(auth(tokens.admin)).send({ systemRole: 'INSTRUCTOR' }).expect(200);

      await api()
        .patch(`/api/v1/admin/courses/${courseId}/owner`)
        .set(auth(tokens.admin))
        .send({ userId: editor.id })
        .expect(200);
      const members = await api().get(`/api/v1/courses/${courseId}/members`).set(auth(tokens.editor)).expect(200);
      const roles = Object.fromEntries(members.body.map((m: { user: { id: string }; role: string }) => [m.user.id, m.role]));
      expect(roles[editor.id]).toBe('OWNER');
      expect(roles[ownerId]).toBe('EDITOR');
      // Trả lại như cũ cho các bước sau.
      await api().patch(`/api/v1/admin/courses/${courseId}/owner`).set(auth(tokens.admin)).send({ userId: ownerId }).expect(200);
      await prisma.courseMember.update({
        where: { courseId_userId: { courseId, userId: editor.id } },
        data: { role: 'EDITOR' },
      });

      const log = await api().get('/api/v1/admin/audit').set(auth(tokens.admin)).expect(200);
      const actions = log.body.map((e: { action: string }) => e.action);
      expect(actions).toEqual(expect.arrayContaining(['settings.update', 'user.role', 'course.transfer']));
      expect(log.body[0].actor).toMatchObject({ email: 'admin@test.vn' });
      const filtered = await api().get('/api/v1/admin/audit').query({ action: 'user' }).set(auth(tokens.admin)).expect(200);
      expect(filtered.body.every((e: { action: string }) => e.action.startsWith('user'))).toBe(true);
    });
  });

  describe('refresh token', () => {
    const cookieOf = (res: request.Response) =>
      (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('docshub_rt='))!.split(';')[0];

    it('xoay vòng, phát hiện token cũ bị dùng lại và thu hồi cả phiên', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: 'learner@test.vn', password: 'Matkhau@123' })
        .expect(200);
      const first = cookieOf(login);

      const refreshed = await api().post('/api/v1/auth/refresh').set('Cookie', first).expect(200);
      const second = cookieOf(refreshed);
      expect(second).not.toBe(first);
      expect(refreshed.body.accessToken).toBeTruthy();

      // Dùng lại token cũ trong thời gian ân hạn: bị từ chối nhưng phiên mới vẫn sống.
      await api().post('/api/v1/auth/refresh').set('Cookie', first).expect(401);
      const third = cookieOf(await api().post('/api/v1/auth/refresh').set('Cookie', second).expect(200));

      // Quá thời gian ân hạn: coi như token bị lộ, thu hồi cả family.
      await prisma.refreshToken.updateMany({
        where: { revokedAt: { not: null } },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });
      await api().post('/api/v1/auth/refresh').set('Cookie', first).expect(401);
      await api().post('/api/v1/auth/refresh').set('Cookie', third).expect(401);
    });

    it('đăng xuất thu hồi refresh token', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: 'editor@test.vn', password: 'Matkhau@123' })
        .expect(200);
      const cookie = cookieOf(login);
      await api().post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
      await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
    });
  });
});

/** Dọn dữ liệu của lần chạy trước. Chỉ chạy trên database có tên kết thúc bằng `_test`. */
async function resetTestDatabase(prisma: PrismaService) {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (!db.endsWith('_test')) {
    throw new Error(`Từ chối dọn dữ liệu: "${db}" không phải database test`);
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE users, courses, refresh_tokens, events, system_settings, audit_logs RESTART IDENTITY CASCADE',
  );
}
