/** Kiểu dữ liệu trả về từ DocsHub API (apps/api). */

export type SystemRole = 'ADMIN' | 'INSTRUCTOR' | 'USER';
export type CourseRole = 'OWNER' | 'EDITOR' | 'LEARNER';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  systemRole: SystemRole;
  /** Theme tự chọn; null = theo khoá học. */
  theme: string | null;
}

export interface VersionSummary {
  id: string;
  slug: string;
  label: string;
  isCurrent: boolean;
}

export interface CourseListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  archivedAt: string | null;
  role: CourseRole | null;
  currentVersion: VersionSummary | null;
}

export interface CategoryNode {
  type: 'category';
  id: string;
  label: string;
  slug: string;
  path: string;
  icon: string | null;
  collapsed: boolean;
  description: string | null;
  children: TreeNode[];
}

export interface DocNode {
  type: 'doc';
  id: string;
  label: string;
  slug: string;
  path: string;
  meta?: { readingTime?: number };
}

export type TreeNode = CategoryNode | DocNode;

export interface ReaderTree {
  course: {
    id: string;
    slug: string;
    title: string;
    coverUrl: string | null;
    theme: string | null;
    primaryColor: string | null;
  };
  version: { id: string; slug: string; label: string };
  versions: VersionSummary[];
  role: CourseRole;
  tree: TreeNode[];
}

export interface TocItem {
  depth: 2 | 3;
  id: string;
  text: string;
}

interface PageContext {
  course: ReaderTree['course'];
  version: ReaderTree['version'];
  breadcrumb: { label: string; path: string }[];
}

export interface DocPage extends PageContext {
  type: 'doc';
  doc: {
    id: string;
    path: string;
    title: string;
    description: string | null;
    tags: string[];
    html: string;
    toc: TocItem[];
    readingTime: number;
    updatedAt: string;
  };
  prev: { label: string; path: string } | null;
  next: { label: string; path: string } | null;
  me: {
    completed: boolean;
    bookmarks: { id: string; anchor: string }[];
    feedback: { helpful: boolean; comment: string | null } | null;
  };
}

export interface CategoryPage extends PageContext {
  type: 'category';
  category: {
    id: string;
    label: string;
    description: string | null;
    icon: string | null;
    items: { type: 'doc' | 'category'; id: string; label: string; path: string }[];
  };
}

export type ReaderPage = DocPage | CategoryPage;

// ===== Studio =====

export type DocStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface StudioDocMeta {
  status: DocStatus;
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
  publishAt: string | null;
}

export interface StudioCategoryNode extends Omit<CategoryNode, 'children'> {
  children: StudioTreeNode[];
}

export interface StudioDocNode extends Omit<DocNode, 'meta'> {
  meta: StudioDocMeta;
}

export type StudioTreeNode = StudioCategoryNode | StudioDocNode;

export interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  ownerId: string;
  archivedAt: string | null;
  theme: string | null;
  primaryColor: string | null;
  role: CourseRole;
  versions: (VersionSummary & { frozenAt: string | null })[];
}

export interface EditorDoc {
  id: string;
  versionId: string;
  categoryId: string | null;
  slug: string;
  path: string;
  readerUrl: string;
  title: string;
  status: DocStatus;
  source: string;
  sourceUpdatedAt: string;
  sourceUpdatedById: string | null;
  publishedRevision: { id: string; number: number; createdAt: string } | null;
  publishedAt: string | null;
  publishAt: string | null;
  hasUnpublishedChanges: boolean;
  versionFrozen: boolean;
  lockedBy: { id: string; name: string; lockedAt: string } | null;
  role: CourseRole;
}

export interface DocSummary {
  id: string;
  versionId: string;
  categoryId: string | null;
  slug: string;
  position: number;
  title: string;
  status: DocStatus;
  sourceUpdatedAt: string;
  publishedRevisionId: string | null;
  publishedAt: string | null;
  publishAt: string | null;
}

export interface RenderWarning {
  rule: string;
  message: string;
  line: number | null;
}

export interface DocMutationResult {
  doc: DocSummary;
  revision: { id: string; number: number; createdAt: string } | null;
  warnings: RenderWarning[];
}

export interface RenderResult {
  html: string;
  toc: TocItem[];
  title: string | null;
  readingTime: number;
  warnings: RenderWarning[];
}

export interface RevisionListItem {
  id: string;
  number: number;
  title: string;
  message: string | null;
  readingTime: number;
  createdAt: string;
  author: { id: string; name: string } | null;
  isPublished: boolean;
}

export interface RevisionDetail extends Omit<RevisionListItem, 'isPublished'> {
  source: string;
  html: string;
}

// ===== Cài đặt khoá học =====

export interface CourseMember {
  role: CourseRole;
  createdAt: string;
  cohort: { id: string; name: string } | null;
  user: User;
}

export interface Cohort {
  id: string;
  name: string;
  versionId: string | null;
  startAt: string | null;
  endAt: string | null;
  version: { id: string; slug: string; label: string } | null;
  _count: { members: number };
}

export interface VersionItem {
  id: string;
  label: string;
  slug: string;
  isCurrent: boolean;
  frozenAt: string | null;
  createdAt: string;
  _count: { docs: number; cohorts: number };
}

export interface EnrollResult {
  enrolled: string[];
  alreadyMembers: string[];
  notFound: string[];
}

// ===== Tìm kiếm, tiến độ, ghi chú =====

export interface SearchHit {
  docId: string;
  path: string;
  anchor: string | null;
  /** HTML đã thoát, chỉ chứa thẻ <mark>. */
  title: string;
  heading: string | null;
  snippet: string;
}

export interface CourseProgress {
  version: { id: string; slug: string };
  total: number;
  completedDocIds: string[];
  percent: number;
  lastDoc: { id: string; path: string; label: string; updatedAt: string } | null;
}

export interface ProgressSummary {
  courseId: string;
  versionSlug?: string;
  total: number;
  completed: number;
  percent: number;
  lastDoc: CourseProgress['lastDoc'];
}

export interface DocLink {
  id: string;
  title: string;
  courseSlug: string;
  courseTitle: string;
  versionSlug: string;
  /** null = bài đã bị gỡ, không mở được. */
  path: string | null;
}

export interface Bookmark {
  id: string;
  anchor: string;
  label: string | null;
  createdAt: string;
  doc: DocLink;
}

export interface Note {
  id: string;
  anchor: string | null;
  quote: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  doc: DocLink;
}

// ===== Thống kê =====

export interface CourseAnalytics {
  version: { id: string; slug: string; label: string };
  days: number;
  overview: {
    learners: number;
    activeLearners: number;
    views: number;
    publishedDocs: number;
    avgCompletion: number;
  };
  daily: { day: string; activeLearners: number; views: number }[];
  docs: {
    docId: string;
    title: string;
    path: string;
    views: number;
    completed: number;
    completionRate: number;
    avgTimeSec: number;
    helpful: number;
    notHelpful: number;
  }[];
  distribution: { label: string; learners: number }[];
  searchMisses: { query: string; count: number }[];
}

// ---------- Quản trị hệ thống ----------

export interface Kpi {
  total: number;
  /** % so với kỳ trước; null = kỳ trước bằng 0. */
  trend: number | null;
}

export interface AdminOverview {
  days: number;
  kpis: {
    users: Kpi & { new: number };
    activeUsers: Kpi;
    views: Kpi;
    searches: Kpi & { misses: number };
    courses: { total: number; archived: number; publishedDocs: number };
    storage: { bytes: number; files: number };
  };
  roles: Partial<Record<SystemRole, number>>;
  daily: { day: string; views: number; activeUsers: number; searches: number; signups: number }[];
  topCourses: { id: string; title: string; slug: string; views: number; learners: number }[];
  recentUsers: {
    id: string;
    name: string;
    email: string;
    systemRole: SystemRole;
    isActive: boolean;
    createdAt: string;
    avatarUrl: string | null;
  }[];
}

export interface AdminUser extends User {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  hasGoogle: boolean;
  courses: number;
  ownedCourses: number;
}

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  theme: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string };
  members: number;
  learners: number;
  versions: number;
  assets: number;
  docs: number;
  publishedDocs: number;
  views30d: number;
  activeLearners30d: number;
}

export interface SystemSettings {
  general: { siteName: string; tagline: string; supportEmail: string | null };
  auth: {
    allowSignup: boolean;
    googleLogin: boolean;
    allowedEmailDomains: string[];
    defaultSystemRole: 'USER' | 'INSTRUCTOR';
  };
  appearance: { defaultTheme: string; defaultPrimaryColor: string | null };
  content: { maxImageMb: number; importEnabled: boolean; importMaxDocs: number };
  learning: { autoCompleteScrollPct: number; autoCompleteSeconds: number };
  announcement: { enabled: boolean; message: string; tone: 'info' | 'warning' | 'danger' };
  maintenance: { enabled: boolean; message: string };
}

export interface AdminSettings {
  settings: SystemSettings;
  defaults: SystemSettings;
  updatedAt: string | null;
}

interface ServiceStatus {
  ok: boolean;
  error?: string;
}

export interface SystemStatus {
  api: { ok: boolean; node: string; env: string; startedAt: string; uptimeSec: number; memoryMb: number };
  database: ServiceStatus & { latencyMs?: number };
  search: ServiceStatus & { index: string; documents?: number; isIndexing?: boolean };
  storage: ServiceStatus & { bucket: string };
  rows: { users: number; courses: number; docs: number; revisions: number; events: number; assets: number };
}

export interface AuditEntry {
  id: string;
  action: string;
  summary: string;
  targetType: string | null;
  targetId: string | null;
  meta: unknown;
  at: string;
  actor: { id: string; name: string; email: string } | null;
}
