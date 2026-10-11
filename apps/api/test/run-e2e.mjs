// Chạy e2e trên database riêng `docshub_test` (không bao giờ đụng database dev/production).
// `migrate deploy` chỉ áp migration còn thiếu; dữ liệu cũ được test tự dọn (xem app.e2e-spec.ts).
import { execSync } from 'node:child_process';
import 'dotenv/config';

const url = new URL(process.env.DATABASE_URL);
url.pathname = '/docshub_test';
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: url.toString(),
  ALLOW_SIGNUP: 'true',
  MEILI_INDEX: 'docshub_test_docs',
};

execSync('prisma migrate deploy', { stdio: 'inherit', env });
execSync('vitest run --config ./vitest.config.e2e.ts', { stdio: 'inherit', env });
