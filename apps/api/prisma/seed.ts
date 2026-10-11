/**
 * Tạo tài khoản admin đầu tiên từ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Chạy: pnpm db:seed. Chạy lại nhiều lần không sao: admin đã có thì bỏ qua.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error('Thiếu SEED_ADMIN_EMAIL hoặc SEED_ADMIN_PASSWORD');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} đã tồn tại, bỏ qua.`);
  } else {
    await prisma.user.create({
      data: {
        email,
        name: 'Quản trị viên',
        passwordHash: await argon2.hash(password),
        systemRole: 'ADMIN',
      },
    });
    console.log(`Đã tạo admin ${email}. Hãy đổi mật khẩu sau khi đăng nhập.`);
  }
} finally {
  await prisma.$disconnect();
}
