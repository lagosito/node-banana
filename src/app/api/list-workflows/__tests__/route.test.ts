import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockOpen = vi.fn();

vi.mock("fs/promises", () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  open: (...args: unknown[]) => mockOpen(...args),
}));

vi.mock("@/utils/pathValidation", () => ({
  validateWorkflowPath: (p: string) => {
    if (p.includes("..")) return { valid: false, resolved: p, error: "Path contains traversal sequences" };
    if (!p.startsWith("/")) return { valid: false, resolved: p, error: "Path must be absolute" };
    if (p.startsWith("/etc")) return { valid: false, resolved: p, error: "Access to /etc is not allowed" };
    return { valid: true, resolved: p };
  },
}));

import { GET } from "../route";

function createRequest(path?: string): NextRequest {
  const url = path
    ? `http://localhost/api/list-workflows?path=${encodeURIComponent(path)}`
    : "http://localhost/api/list-workflows";
  return new NextRequest(url);
}

function createFileHandle(content: string) {
  const buf = Buffer.from(content);
  return {
    read: vi.fn().mockResolvedValue({ bytesRead: buf.length }),
    close: vi.fn().mockResolvedValue(undefined),
    // Store the buffer for inspection — the actual route allocates its own buffer
    _content: content,
  };
}

describe("/api/list-workflows route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Override mockOpen to simulate filling the buffer with file content
    mockOpen.mockImplementation(async (filePath: string) => {
      const handle = createFileHandle("");
      // We'll configure per-test below by re-mocking
      return handle;
    });
  });

  describe("parameter validation", () => {
    it("should return 400 when path parameter is missing", async () => {
      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Path parameter required");
    });

    it("should return 400 for path traversal attempts", async () => {
      const response = await GET(createRequest("/home/user/../etc/passwd"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("traversal");
    });

    it("should return 400 for dangerous system paths", async () => {
      const response = await GET(createRequest("/etc/config"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("directory probing", () => {
    it("should return empty array when parent has no subdirectories", async () => {
      mockReaddir.mockResolvedValue([]);

      const response = await GET(createRequest("/home/user/projects"));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.workflows).toEqual([]);
    });

    it("should skip subdirectories without JSON files", async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: "empty-dir", isDirectory: () => true },
      ]);
      // readdir for the subdirectory itself returns no files
      mockReaddir.mockResolvedValueOnce([]);

      const response = await GET(createRequest("/home/user/projects"));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.workflows).toEqual([]);
    });

    it("should detect a valid workflow and extract name from header", async () => {
      // Parent dir has one subdirectory
      mockReaddir.mockResolvedValueOnce([
        { name: "my-project", isDirectory: () => true },
      ]);
      // Subdirectory has one JSON file
      mockReaddir.mockResolvedValueOnce(["workflow.json"]);

      const workflowHeader = '{"version":1,"name":"Cool Project","nodes":[';
      const headerBuf = Buffer.from(workflowHeader);

      mockOpen.mockResolvedValue({
        read: vi.fn().mockImplementation(async (buf: Buffer) => {
          headerBuf.copy(buf, 0, 0, Math.min(headerBuf.length, buf.length));
          return { bytesRead: Math.min(headerBuf.length, buf.length) };
        }),
        close: vi.fn().mockResolvedValue(undefined),
      });

      mockStat.mockResolvedValue({ mtimeMs: 1700000000000 });

      const response = await GET(createRequest("/home/user/projects"));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.workflows).toHaveLength(1);
      expect(data.workflows[0].name).toBe("Cool Project");
      expect(data.workflows[0].directoryPath).toBe("/home/user/projects/my-project");
      expect(data.workflows[0].lastModified).toBe(1700000000000);
    });

    it("should skip JSON files that are not workflow files", async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: "my-project", isDirectory: () => true },
      ]);
      mockReaddir.mockResolvedValueOnce(["package.json"]);

      // package.json doesn't contain "version" + "nodes"
      const notWorkflow = '{"name":"my-app","version":"1.0.0","dependencies":{}}';
      const notBuf = Buffer.from(notWorkflow);

      mockOpen.mockResolvedValue({
        read: vi.fn().mockImplementation(async (buf: Buffer) => {
          notBuf.copy(buf, 0, 0, Math.min(notBuf.length, buf.length));
          return { bytesRead: Math.min(notBuf.length, buf.length) };
        }),
        close: vi.fn().mockResolvedValue(undefined),
      });

      const response = await GET(createRequest("/home/user/projects"));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.workflows).toEqual([]);
    });

    it("should fall back to directory name when workflow has no name field", async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: "unnamed-project", isDirectory: () => true },
      ]);
      mockReaddir.mockResolvedValueOnce(["workflow.json"]);

      // No "name" field but has version + nodes
      const noNameHeader = '{"version":1,"nodes":[{"id":"1"}],"edges":[]}';
      const noNameBuf = Buffer.from(noNameHeader);

      mockOpen.mockResolvedValue({
        read: vi.fn().mockImplementation(async (buf: Buffer) => {
          noNameBuf.copy(buf, 0, 0, Math.min(noNameBuf.length, buf.length));
          return { bytesRead: Math.min(noNameBuf.length, buf.length) };
        }),
        close: vi.fn().mockResolvedValue(undefined),
      });

      mockStat.mockResolvedValue({ mtimeMs: 1700000000000 });

      const response = await GET(createRequest("/home/user/projects"));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.workflows).toHaveLength(1);
      expect(data.workflows[0].name).toBe("unnamed-project");
    });

    it("should sort workflows by most recently modified first", async () => {
      mockReaddir.mockResolvedValueOnce([
        { name: "old-project", isDirectory: () => true },
        { name: "new-project", isDirectory: () => true },
      ]);

      // Old project
      mockReaddir.mockResolvedValueOnce(["workflow.json"]);
      // New project
      mockReaddir.mockResolvedValueOnce(["workflow.json"]);

      const workflowHeader = '{"version":1,"name":"Test","nodes":[]}';
      const headerBuf = Buffer.from(workflowHeader);

      mockOpen.mockResolvedValue({
        read: vi.fn().mockImplementation(async (buf: Buffer) => {
          headerBuf.copy(buf, 0, 0, Math.min(headerBuf.length, buf.length));
          return { bytesRead: Math.min(headerBuf.length, buf.length) };
        }),
        close: vi.fn().mockResolvedValue(undefined),
      });

      // old-project was modified before new-project
      mockStat
        .mockResolvedValueOnce({ mtimeMs: 1600000000000 })
        .mockResolvedValueOnce({ mtimeMs: 1700000000000 });

      const response = await GET(createRequest("/home/user/projects"));
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.workflows).toHaveLength(2);
      // Newer project should come first
      expect(data.workflows[0].lastModified).toBe(1700000000000);
      expect(data.workflows[1].lastModified).toBe(1600000000000);
    });
  });

  describe("error handling", () => {
    it("should return 500 when readdir fails on parent directory", async () => {
      mockReaddir.mockRejectedValue(new Error("ENOENT: no such directory"));

      const response = await GET(createRequest("/home/user/nonexistent"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("ENOENT");
    });
  });
});
