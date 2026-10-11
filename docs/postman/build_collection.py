"""Sinh Postman collection cho DocsHub API. Chạy lại script này khi thêm endpoint."""
import json

def tests(*lines):
    return [{"listen": "test", "script": {"type": "text/javascript", "exec": list(lines)}}]

def req(name, method, path, body=None, test_lines=(), token=None, description=None, query=None):
    url_path = path.lstrip("/").split("/")
    raw = "{{baseUrl}}/" + path.lstrip("/")
    url = {"raw": raw, "host": ["{{baseUrl}}"], "path": url_path}
    if query:
        url["query"] = [{"key": k, "value": v} for k, v in query]
        url["raw"] += "?" + "&".join(f"{k}={v}" for k, v in query)
    r = {"method": method, "header": [], "url": url}
    if body is not None:
        r["header"].append({"key": "Content-Type", "value": "application/json"})
        r["body"] = {"mode": "raw", "raw": json.dumps(body, ensure_ascii=False, indent=2),
                     "options": {"raw": {"language": "json"}}}
    if token == "none":
        r["auth"] = {"type": "noauth"}
    elif token:
        r["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": token, "type": "string"}]}
    if description:
        r["description"] = description
    item = {"name": name, "request": r}
    if test_lines:
        item["event"] = tests(*test_lines)
    return item

def status(code):
    return f'pm.test("Status {code}", () => pm.response.to.have.status({code}));'

DRAFT = "\n".join([
    "---",
    "title: Provider và Dependency Injection",
    "slug: provider",
    "sidebar_position: 1",
    "---",
    "",
    ":::tip[Ghi nhớ]",
    "Provider được tiêm qua constructor.",
    ":::",
    "",
    "## Tạo provider",
    "",
    "```ts title=\"cats.service.ts\" {1}",
    "@Injectable()",
    "export class CatsService {}",
    "```",
    "",
    "Công thức $E = mc^2$.",
])

folders = [
    {"name": "0. Health", "item": [
        req("Health check", "GET", "/health", token="none",
            test_lines=[status(200), 'pm.test("DB up", () => pm.expect(pm.response.json().database).to.eql("up"));']),
    ]},
    {"name": "1. Auth", "item": [
        req("Đăng nhập admin", "POST", "/auth/login", token="none",
            body={"email": "{{adminEmail}}", "password": "{{adminPassword}}"},
            description="Admin được tạo bởi `pnpm db:seed`. Lưu access token vào biến `accessToken` (dùng mặc định cho mọi request).",
            test_lines=[status(200),
                        'const body = pm.response.json();',
                        'pm.collectionVariables.set("accessToken", body.accessToken);',
                        'pm.collectionVariables.set("adminToken", body.accessToken);']),
        req("Thông tin tài khoản (me)", "GET", "/auth/me",
            test_lines=[status(200), 'pm.test("Là admin", () => pm.expect(pm.response.json().systemRole).to.eql("ADMIN"));']),
        req("Refresh token (dùng cookie)", "POST", "/auth/refresh", token="none",
            description="Không cần body: Postman tự gửi cookie `docshub_rt` nhận được lúc đăng nhập. Mỗi lần gọi, cookie được xoay sang token mới.",
            test_lines=[status(200),
                        'pm.collectionVariables.set("accessToken", pm.response.json().accessToken);',
                        'pm.collectionVariables.set("adminToken", pm.response.json().accessToken);']),
        req("Đăng ký học viên", "POST", "/auth/register", token="none",
            body={"email": "{{learnerEmail}}", "password": "Matkhau@123", "name": "Học viên Postman"},
            description="Pre-request script tạo email ngẫu nhiên để chạy lại collection nhiều lần không bị trùng.",
            test_lines=[status(201),
                        'const body = pm.response.json();',
                        'pm.collectionVariables.set("learnerToken", body.accessToken);',
                        'pm.collectionVariables.set("learnerId", body.user.id);']),
    ]},
    {"name": "2. Users (admin)", "item": [
        req("Danh sách người dùng", "GET", "/users", query=[("q", "postman")], test_lines=[status(200)]),
        req("Cấp quyền giảng viên", "PATCH", "/users/{{learnerId}}", body={"systemRole": "USER"},
            description="Đổi `systemRole` thành `INSTRUCTOR` để người đó được tạo khoá học. Ví dụ này giữ `USER` cho học viên.",
            test_lines=[status(200)]),
    ]},
    {"name": "3. Khoá học", "item": [
        req("Tạo khoá học", "POST", "/courses",
            body={"title": "Lập trình NestJS cơ bản", "description": "Khoá học thử bằng Postman", "versionLabel": "2026"},
            description="Slug tự sinh từ tiêu đề; trùng thì thêm hậu tố -2, -3...",
            test_lines=[status(201),
                        'const body = pm.response.json();',
                        'pm.collectionVariables.set("courseId", body.id);',
                        'pm.collectionVariables.set("courseSlug", body.slug);',
                        'pm.collectionVariables.set("versionId", body.versions[0].id);',
                        'pm.collectionVariables.set("versionSlug", body.versions[0].slug);']),
        req("Danh sách khoá học của tôi", "GET", "/courses", test_lines=[status(200)]),
        req("Chi tiết khoá học (theo slug)", "GET", "/courses/{{courseSlug}}", test_lines=[status(200)]),
        req("Ghi danh học viên", "POST", "/courses/{{courseId}}/members/enroll",
            body={"emails": ["{{learnerEmail}}", "chua-co-tai-khoan@example.com"]},
            test_lines=[status(200),
                        'pm.test("Đã ghi danh", () => pm.expect(pm.response.json().enrolled).to.have.length(1));']),
        req("Danh sách thành viên", "GET", "/courses/{{courseId}}/members", test_lines=[status(200)]),
    ]},
    {"name": "4. Studio (soạn bài)", "item": [
        req("Tạo nhóm bài", "POST", "/versions/{{versionId}}/categories",
            body={"label": "Kiến trúc", "icon": "layers"},
            test_lines=[status(201),
                        'pm.collectionVariables.set("categoryId", pm.response.json().id);',
                        'pm.collectionVariables.set("categorySlug", pm.response.json().slug);']),
        req("Tạo bài viết", "POST", "/versions/{{versionId}}/docs",
            body={"title": "Provider", "categoryId": "{{categoryId}}"},
            test_lines=[status(201), 'pm.collectionVariables.set("docId", pm.response.json().id);']),
        req("Autosave bản nháp", "PUT", "/docs/{{docId}}/draft", body={"source": DRAFT},
            description="Autosave: chỉ ghi bản nháp, không tạo revision. Title/slug/sidebar_position đồng bộ từ frontmatter.",
            test_lines=[status(200),
                        'const doc = pm.response.json().doc;',
                        'pm.collectionVariables.set("docSlug", doc.slug);',
                        'pm.collectionVariables.set("sourceUpdatedAt", doc.sourceUpdatedAt);']),
        req("Lưu (Ctrl+S) tạo revision", "PUT", "/docs/{{docId}}/draft",
            body={"source": DRAFT, "baseUpdatedAt": "{{sourceUpdatedAt}}", "createRevision": True, "message": "Bản đầu tiên"},
            test_lines=[status(200),
                        'pm.test("Có revision", () => pm.expect(pm.response.json().revision.number).to.eql(1));']),
        req("Preview render", "POST", "/render/preview",
            body={"versionId": "{{versionId}}", "source": ":::warning\nCẩn thận\n:::\n\n[Link hỏng](./khong-co.md)"},
            description="Trả về `html`, `toc`, `frontmatter`, `warnings` (lint).",
            test_lines=[status(200),
                        'pm.test("Có cảnh báo link hỏng", () => pm.expect(pm.response.json().warnings[0].rule).to.eql("broken-link"));']),
        req("Xem bài trong editor", "GET", "/docs/{{docId}}", test_lines=[status(200)]),
        req("Xuất bản", "POST", "/docs/{{docId}}/publish", body={"message": "Xuất bản lần đầu"},
            description="Chỉ OWNER. Thêm `publishAt` (ISO) để hẹn giờ mở bài.",
            test_lines=[status(200),
                        'pm.test("Đã xuất bản", () => pm.expect(pm.response.json().doc.status).to.eql("PUBLISHED"));']),
        req("Lịch sử revision", "GET", "/docs/{{docId}}/revisions", test_lines=[status(200)]),
        req("Cây nội dung Studio", "GET", "/versions/{{versionId}}/tree", test_lines=[status(200)]),
    ]},
    {"name": "5. Học viên đọc bài", "item": [
        req("Sidebar khoá học", "GET", "/read/{{courseSlug}}/tree", token="{{learnerToken}}",
            test_lines=[status(200),
                        'pm.test("Có bài vừa xuất bản", () => pm.expect(JSON.stringify(pm.response.json().tree)).to.include(pm.collectionVariables.get("docSlug")));']),
        req("Trang bài viết", "GET", "/read/{{courseSlug}}/page", token="{{learnerToken}}",
            query=[("path", "{{categorySlug}}/{{docSlug}}")],
            test_lines=[status(200),
                        'pm.test("Có HTML admonition", () => pm.expect(pm.response.json().doc.html).to.include("admonition-tip"));']),
        req("Học viên không vào được Studio", "GET", "/docs/{{docId}}", token="{{learnerToken}}",
            test_lines=[status(403)]),
        req("Tìm kiếm trong khoá", "GET", "/read/{{courseSlug}}/search", token="{{learnerToken}}",
            query=[("q", "tiem qua constructor")],
            description="Meilisearch, gõ không dấu vẫn ra. Chỉ mục được lập lại ~1,5 giây sau khi xuất bản, "
                        "nên chạy ngay sau bước Xuất bản có thể chưa có kết quả.",
            test_lines=[status(200)]),
        req("Nhịp đọc (tiến độ)", "PUT", "/progress/{{docId}}", token="{{learnerToken}}",
            body={"scrollPct": 95, "secondsDelta": 40},
            description="Trang đọc gửi mỗi 15 giây. Tự hoàn thành khi cuộn ≥ 90% và tổng thời gian ≥ 30 giây.",
            test_lines=[status(200),
                        'pm.test("Tự hoàn thành", () => pm.expect(pm.response.json().completed).to.eql(true));']),
        req("Tiến độ trong khoá", "GET", "/me/progress", token="{{learnerToken}}",
            query=[("course", "{{courseSlug}}")],
            test_lines=[status(200),
                        'pm.test("Đã xong 1 bài", () => pm.expect(pm.response.json().completedDocIds).to.include(pm.collectionVariables.get("docId")));']),
        req("Lưu bài (bookmark)", "POST", "/me/bookmarks", token="{{learnerToken}}",
            body={"docId": "{{docId}}", "anchor": "", "label": "Provider"},
            description="`anchor` rỗng = lưu cả bài; điền id heading để lưu một mục.",
            test_lines=[status(201)]),
        req("Ghi chú", "POST", "/me/notes", token="{{learnerToken}}",
            body={"docId": "{{docId}}", "quote": "Provider được tiêm qua constructor.", "content": "Nhớ thêm @Injectable()"},
            test_lines=[status(201)]),
        req("Đã lưu của tôi", "GET", "/me/bookmarks", token="{{learnerToken}}", test_lines=[status(200)]),
        req("Đánh giá bài", "PUT", "/docs/{{docId}}/feedback", token="{{learnerToken}}",
            body={"helpful": False, "comment": "Cần thêm ví dụ"}, test_lines=[status(200)]),
    ]},
    {"name": "5b. Thống kê (chủ khoá)", "item": [
        req("Dashboard khoá học", "GET", "/analytics/courses/{{courseId}}", query=[("days", "30")],
            description="`days` = 7 | 30 | 90, `version` = slug (mặc định version hiện hành). Chỉ OWNER.",
            test_lines=[status(200),
                        'pm.test("Có 1 học viên hoàn thành", () => pm.expect(pm.response.json().docs[0].completed).to.eql(1));']),
    ]},
    {"name": "6. Version", "item": [
        req("Cắt version mới", "POST", "/courses/{{courseId}}/versions",
            body={"label": "2027", "copyFromVersionId": "{{versionId}}", "makeCurrent": False},
            description="Sao chép toàn bộ cây bài sang version mới. `makeCurrent: true` để học viên mặc định đọc version này.",
            test_lines=[status(201)]),
        req("Danh sách version", "GET", "/courses/{{courseId}}/versions", test_lines=[status(200)]),
    ]},
    {"name": "7. Đăng xuất", "item": [
        req("Đăng xuất", "POST", "/auth/logout", token="none", test_lines=[status(204)]),
        req("Refresh sau đăng xuất bị từ chối", "POST", "/auth/refresh", token="none", test_lines=[status(401)]),
    ]},
]

# Email học viên ngẫu nhiên cho mỗi lần chạy.
folders[1]["item"][3]["event"].insert(0, {"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
    'pm.collectionVariables.set("learnerEmail", `hocvien.postman.${Date.now()}@example.com`);'
]}})

collection = {
    "info": {
        "name": "DocsHub API",
        "description": "Luồng chính của DocsHub API. Chạy theo thứ tự từ trên xuống (Run collection). "
                       "Token và id được tự lưu vào biến collection sau mỗi request.",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{accessToken}}", "type": "string"}]},
    "variable": [{"key": k, "value": ""} for k in [
        "accessToken", "adminToken", "learnerToken", "learnerId", "learnerEmail", "courseId", "courseSlug",
        "versionId", "versionSlug", "categoryId", "categorySlug", "docId", "docSlug", "sourceUpdatedAt"]],
    "item": folders,
}

environment = {
    "name": "DocsHub Local",
    "values": [
        {"key": "baseUrl", "value": "http://localhost:4999/api/v1", "enabled": True},
        {"key": "adminEmail", "value": "admin@docshub.local", "enabled": True},
        {"key": "adminPassword", "value": "Admin@123456", "type": "secret", "enabled": True},
    ],
}

with open("DocsHub.postman_collection.json", "w", encoding="utf-8") as f:
    json.dump(collection, f, ensure_ascii=False, indent=2)
with open("DocsHub.local.postman_environment.json", "w", encoding="utf-8") as f:
    json.dump(environment, f, ensure_ascii=False, indent=2)
print("ok")
