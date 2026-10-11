import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Mọi trang đều cần đăng nhập và cá nhân hoá theo người dùng, nên không dùng Cache Components.
  cacheComponents: false,
  experimental: {
    // proxy.ts chạy trên cả /api/v1/* nên Next giữ bản sao body trong bộ nhớ; mặc định chỉ 10 MB
    // (vượt thì bị cắt lặng lẽ). Nhập tài liệu gửi tối đa 50 MB.
    proxyClientMaxBodySize: '55mb',
  },
};

export default nextConfig;
