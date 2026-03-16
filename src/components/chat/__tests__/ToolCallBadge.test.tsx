import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolLabel } from "../ToolCallBadge";

vi.mock("lucide-react", () => ({
  Loader2: ({ className }: { className?: string }) => (
    <svg data-testid="spinner" className={className} />
  ),
}));

afterEach(() => {
  cleanup();
});

// getToolLabel unit tests
test("getToolLabel: str_replace_editor create returns Creating <filename>", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/components/Button.tsx" })).toBe("Creating Button.tsx");
});

test("getToolLabel: str_replace_editor str_replace returns Editing <filename>", () => {
  expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/components/Button.tsx" })).toBe("Editing Button.tsx");
});

test("getToolLabel: str_replace_editor insert returns Editing <filename>", () => {
  expect(getToolLabel("str_replace_editor", { command: "insert", path: "/components/Button.tsx" })).toBe("Editing Button.tsx");
});

test("getToolLabel: str_replace_editor view returns Viewing <filename>", () => {
  expect(getToolLabel("str_replace_editor", { command: "view", path: "/components/Button.tsx" })).toBe("Viewing Button.tsx");
});

test("getToolLabel: str_replace_editor undo_edit returns Undoing edit on <filename>", () => {
  expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/components/Button.tsx" })).toBe("Undoing edit on Button.tsx");
});

test("getToolLabel: str_replace_editor with no args falls back to tool name", () => {
  expect(getToolLabel("str_replace_editor", {})).toBe("str_replace_editor");
});

test("getToolLabel: file_manager rename returns Renaming <filename>", () => {
  expect(getToolLabel("file_manager", { operation: "rename", path: "/components/Component.tsx" })).toBe("Renaming Component.tsx");
});

test("getToolLabel: file_manager delete returns Deleting <filename>", () => {
  expect(getToolLabel("file_manager", { operation: "delete", path: "/components/Component.tsx" })).toBe("Deleting Component.tsx");
});

test("getToolLabel: unknown tool name returns tool name as-is", () => {
  expect(getToolLabel("some_other_tool", { path: "/foo.tsx" })).toBe("some_other_tool");
});

// ToolCallBadge component tests
test("ToolCallBadge shows friendly label for create command", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/components/Card.tsx" }}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("Creating Card.tsx")).toBeDefined();
});

test("ToolCallBadge shows friendly label for str_replace command", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "str_replace", path: "/components/App.tsx" }}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("Editing App.tsx")).toBeDefined();
});

test("ToolCallBadge shows green dot when done (state=result with result)", () => {
  const { container } = render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/components/Card.tsx" }}
      state="result"
      result="Success"
    />
  );
  const dot = container.querySelector(".bg-emerald-500");
  expect(dot).not.toBeNull();
  expect(screen.queryByTestId("spinner")).toBeNull();
});

test("ToolCallBadge shows spinner when in-progress (state=call)", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/components/Card.tsx" }}
      state="call"
    />
  );
  expect(screen.getByTestId("spinner")).toBeDefined();
});

test("ToolCallBadge shows spinner when result is null", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/components/Card.tsx" }}
      state="result"
      result={null}
    />
  );
  expect(screen.getByTestId("spinner")).toBeDefined();
});

test("ToolCallBadge falls back to tool name for empty args", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{}}
      state="result"
      result="Success"
    />
  );
  expect(screen.getByText("str_replace_editor")).toBeDefined();
});
