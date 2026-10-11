// Tạo khoá học demo qua API (cần API đang chạy và đã seed admin).
// Chạy: pnpm --filter @docshub/api seed:demo
// Tạo thêm tài khoản học viên demo: hocvien@docshub.local / Hocvien@123
import 'dotenv/config';

const API = process.env.DEMO_API_URL ?? `http://localhost:${process.env.PORT ?? 4999}/api/v1`;
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD };
const LEARNER = { email: 'hocvien@docshub.local', password: 'Hocvien@123', name: 'Học viên Demo' };

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`), { status: res.status });
  return data;
}

const DOCS = [
  {
    category: null,
    title: 'Giới thiệu khoá học',
    source: `---
title: Giới thiệu khoá học
sidebar_label: Giới thiệu
---

Chào mừng bạn đến với khoá **Lập trình NestJS cơ bản**. Khoá học giúp bạn xây dựng API Node.js có cấu trúc rõ ràng, dễ test và dễ mở rộng.

## Bạn sẽ học được gì

- [x] Tổ chức ứng dụng theo module
- [x] Viết controller và provider
- [ ] Kết nối database với Prisma *(phần sau)*

:::info[Yêu cầu]
Bạn cần biết JavaScript cơ bản và đã cài Node.js 24 trở lên.
:::

Bắt đầu với bài [NestJS là gì?](./01-gioi-thieu/01-nestjs-la-gi.md).
`,
  },
  {
    category: 'Bắt đầu',
    icon: 'rocket',
    title: 'NestJS là gì?',
    source: `---
title: NestJS là gì?
slug: nestjs-la-gi
---

NestJS là framework để xây dựng ứng dụng phía server bằng TypeScript, lấy cảm hứng từ Angular.

## Kiến trúc tổng quan

\`\`\`mermaid
graph LR
  Client -->|HTTP| Controller
  Controller --> Service
  Service --> Repository
  Repository --> DB[(PostgreSQL)]
\`\`\`

## Vì sao chọn NestJS

| Tiêu chí | Express thuần | NestJS |
| --- | --- | --- |
| Cấu trúc dự án | Tự quyết | Module rõ ràng |
| Dependency Injection | Không có | Có sẵn |
| TypeScript | Tuỳ chọn | Mặc định |

:::tip
Nếu đã quen Angular, bạn sẽ thấy decorator và DI của NestJS rất quen thuộc.
:::
`,
  },
  {
    category: 'Bắt đầu',
    title: 'Cài đặt',
    source: `---
title: Cài đặt dự án
slug: cai-dat
---

Tạo dự án mới bằng Nest CLI.

::::tabs
:::tab{label="npm"}
\`\`\`bash
npx @nestjs/cli new my-app
\`\`\`
:::
:::tab{label="pnpm"}
\`\`\`bash
pnpm dlx @nestjs/cli new my-app
\`\`\`
:::
::::

## Chạy thử

\`\`\`bash title="Terminal"
cd my-app
pnpm start:dev
\`\`\`

:::warning[Cổng bị chiếm]
Nếu cổng 3000 đang được dùng, đặt biến môi trường \`PORT\` sang cổng khác.
:::
`,
  },
  {
    category: 'Kiến trúc',
    icon: 'layers',
    title: 'Module',
    source: `---
title: Module
slug: module
---

Module gom các controller và provider liên quan thành một khối.

\`\`\`ts title="cats.module.ts" {4-5} showLineNumbers
import { Module } from '@nestjs/common';

@Module({
  controllers: [CatsController],
  providers: [CatsService],
})
export class CatsModule {}
\`\`\`

## Module dùng chung

Thêm provider vào \`exports\` để module khác dùng được. Xem tiếp [Provider](./03-provider.md).
`,
  },
  {
    category: 'Kiến trúc',
    title: 'Provider và Dependency Injection',
    source: `---
title: Provider và Dependency Injection
slug: provider
---

Provider là class được Nest tạo và **tiêm** vào nơi cần dùng.

## Khai báo provider

\`\`\`ts title="cats.service.ts"
@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [];

  findAll(): Cat[] {
    return this.cats;
  }
}
\`\`\`

## Tiêm vào controller

\`\`\`ts
@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}
}
\`\`\`

### Phạm vi (scope)

Mặc định provider là singleton. Số instance được tạo ra với $n$ request là:

$$
\\text{instances} = \\begin{cases} 1 & \\text{DEFAULT} \\\\ n & \\text{REQUEST} \\end{cases}
$$

:::danger
Đừng dùng scope \`REQUEST\` cho provider nặng: mỗi request sẽ tạo lại toàn bộ chuỗi phụ thuộc.
:::
`,
  },
];

async function main() {
  console.log(`API: ${API}`);
  const admin = await call('POST', '/auth/login', ADMIN);
  const token = admin.accessToken;

  try {
    await call('POST', '/auth/register', LEARNER);
    console.log(`Đã tạo học viên ${LEARNER.email}`);
  } catch (error) {
    if (error.status !== 409) throw error;
  }

  const course = await call('POST', '/courses', {
    title: 'Lập trình NestJS cơ bản',
    description: 'Khoá học demo: module, controller, provider và dependency injection.',
    versionLabel: '2026',
  }, token);
  const versionId = course.versions[0].id;
  console.log(`Khoá học: ${course.slug}`);

  const categories = new Map();
  for (const doc of DOCS) {
    let categoryId;
    if (doc.category) {
      if (!categories.has(doc.category)) {
        const created = await call('POST', `/versions/${versionId}/categories`, { label: doc.category, icon: doc.icon }, token);
        categories.set(doc.category, created.id);
      }
      categoryId = categories.get(doc.category);
    }
    const created = await call('POST', `/versions/${versionId}/docs`, { title: doc.title, categoryId }, token);
    await call('PUT', `/docs/${created.id}/draft`, { source: doc.source }, token);
    doc.id = created.id;
  }
  // Xuất bản sau khi đã tạo đủ bài, để link nội bộ giữa các bài trỏ đúng.
  for (const doc of DOCS) {
    const published = await call('POST', `/docs/${doc.id}/publish`, { message: 'Bản demo' }, token);
    for (const w of published.warnings) console.log(`  ! ${doc.title}: dòng ${w.line}: ${w.message}`);
  }

  await call('POST', `/courses/${course.id}/members/enroll`, { emails: [LEARNER.email] }, token);
  console.log(`Xong. Đăng nhập web bằng ${LEARNER.email} / ${LEARNER.password} để đọc /courses/${course.slug}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
