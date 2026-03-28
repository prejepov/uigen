import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

import { useAuth } from "@/hooks/use-auth";

const ANON_MESSAGES = [{ role: "user", content: "hello" }];
const ANON_FS_DATA = { "/": { type: "directory" }, "/App.tsx": { type: "file" } };

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
    mockSignInAction.mockResolvedValue({ success: true });
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "new-project-id" });
  });

  describe("initial state", () => {
    it("starts with isLoading false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    describe("happy path — anon work with messages", () => {
      it("creates a project from anon work and navigates to it", async () => {
        mockGetAnonWorkData.mockReturnValue({ messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA });
        mockCreateProject.mockResolvedValue({ id: "anon-project-id" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: ANON_MESSAGES,
          data: ANON_FS_DATA,
        });
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });

      it("does not fetch existing projects when anon work is present", async () => {
        mockGetAnonWorkData.mockReturnValue({ messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockGetProjects).not.toHaveBeenCalled();
      });
    });

    describe("happy path — anon work with empty messages", () => {
      it("falls through to existing projects check when messages array is empty", async () => {
        mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
        mockGetProjects.mockResolvedValue([{ id: "existing-id" }]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockGetProjects).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-id");
      });
    });

    describe("happy path — no anon work, existing projects", () => {
      it("navigates to the most recent project", async () => {
        mockGetProjects.mockResolvedValue([
          { id: "recent-id" },
          { id: "older-id" },
        ]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-id");
        expect(mockCreateProject).not.toHaveBeenCalled();
      });
    });

    describe("happy path — no anon work, no existing projects", () => {
      it("creates a new project and navigates to it", async () => {
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "brand-new-id" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
      });

      it("generates a random name for the new project", async () => {
        mockGetProjects.mockResolvedValue([]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        const { name } = mockCreateProject.mock.calls[0][0];
        expect(name).toMatch(/^New Design #\d+$/);
      });
    });

    describe("failure path", () => {
      it("returns the failed result without navigating", async () => {
        mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());
        let returned: unknown;
        await act(async () => {
          returned = await result.current.signIn("user@example.com", "wrong");
        });

        expect(returned).toEqual({ success: false, error: "Invalid credentials" });
        expect(mockPush).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
      });
    });

    describe("isLoading state", () => {
      it("is true while signIn is in progress and false after", async () => {
        let resolveSignIn!: (v: unknown) => void;
        mockSignInAction.mockReturnValue(new Promise((r) => { resolveSignIn = r; }));

        const { result } = renderHook(() => useAuth());

        act(() => { result.current.signIn("user@example.com", "password123"); });
        expect(result.current.isLoading).toBe(true);

        await act(async () => { resolveSignIn({ success: false, error: "err" }); });
        expect(result.current.isLoading).toBe(false);
      });

      it("resets isLoading to false even if post-sign-in throws", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetProjects.mockRejectedValue(new Error("DB error"));

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    it("passes credentials to the signIn action", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "secret123");
      });

      expect(mockSignInAction).toHaveBeenCalledWith("test@example.com", "secret123");
    });

    it("returns the successful result", async () => {
      mockGetProjects.mockResolvedValue([{ id: "p1" }]);

      const { result } = renderHook(() => useAuth());
      let returned: unknown;
      await act(async () => {
        returned = await result.current.signIn("user@example.com", "password123");
      });

      expect(returned).toEqual({ success: true });
    });
  });

  describe("signUp", () => {
    describe("happy path — anon work with messages", () => {
      it("creates a project from anon work and navigates to it", async () => {
        mockGetAnonWorkData.mockReturnValue({ messages: ANON_MESSAGES, fileSystemData: ANON_FS_DATA });
        mockCreateProject.mockResolvedValue({ id: "signup-anon-id" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: ANON_MESSAGES, data: ANON_FS_DATA })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/signup-anon-id");
      });
    });

    describe("happy path — no anon work, existing projects", () => {
      it("navigates to the most recent project", async () => {
        mockGetProjects.mockResolvedValue([{ id: "signup-project-id" }]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/signup-project-id");
      });
    });

    describe("happy path — no anon work, no projects", () => {
      it("creates a new project and navigates to it", async () => {
        mockCreateProject.mockResolvedValue({ id: "signup-new-id" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/signup-new-id");
      });
    });

    describe("failure path", () => {
      it("returns the failed result without navigating", async () => {
        mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

        const { result } = renderHook(() => useAuth());
        let returned: unknown;
        await act(async () => {
          returned = await result.current.signUp("existing@example.com", "password123");
        });

        expect(returned).toEqual({ success: false, error: "Email already registered" });
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    describe("isLoading state", () => {
      it("is true while signUp is in progress and false after", async () => {
        let resolveSignUp!: (v: unknown) => void;
        mockSignUpAction.mockReturnValue(new Promise((r) => { resolveSignUp = r; }));

        const { result } = renderHook(() => useAuth());

        act(() => { result.current.signUp("new@example.com", "password123"); });
        expect(result.current.isLoading).toBe(true);

        await act(async () => { resolveSignUp({ success: false, error: "err" }); });
        expect(result.current.isLoading).toBe(false);
      });

      it("resets isLoading to false even if post-sign-up throws", async () => {
        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetProjects.mockRejectedValue(new Error("DB error"));

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "password123").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    it("passes credentials to the signUp action", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "mypassword");
      });

      expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "mypassword");
    });
  });

  describe("edge cases", () => {
    it("does not navigate when getAnonWorkData returns null", async () => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "fallback-id" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/fallback-id");
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    it("signIn and signUp do not share isLoading state between calls", async () => {
      mockGetProjects.mockResolvedValue([{ id: "p1" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => { await result.current.signIn("a@b.com", "pass"); });
      expect(result.current.isLoading).toBe(false);

      await act(async () => { await result.current.signUp("c@d.com", "pass"); });
      expect(result.current.isLoading).toBe(false);
    });
  });
});
