import "fake-indexeddb/auto";
import { beforeEach, afterEach, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => {
  const icons = [
    "Users",
    "CalendarDays",
    "ClipboardList",
    "FileText",
    "Activity",
    "Download",
    "BarChart2",
    "Plus",
    "Search",
    "UserPlus",
    "Leaf",
    "ScanLine",
    "CheckCircle2",
    "LogOut",
    "RotateCcw",
    "X",
    "Circle",
    "AlertCircle",
    "MapPin",
    "Eye",
    "Download",
    "Pen",
    "Trash2",
    "Square",
    "RefreshCw",
    "WifiOff",
    "Database",
    "ArrowDownTray",
  ];
  const mockIcon = (name: string) => ({
    name,
    render: () => null,
  });
  return icons.reduce((acc, name) => ({ ...acc, [name]: mockIcon(name) }), {});
});

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn(), resolvedTheme: "light" }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(),
  createServerClient: vi.fn(),
}));

// Mock environment
vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: false,
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  assertSupabaseConfigured: vi.fn(),
}));

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global test timeout
vi.setConfig({ testTimeout: 10000 });
