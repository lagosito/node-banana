import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { validateWorkflowPath } from "@/utils/pathValidation";

interface WorkflowListEntry {
  name: string;
  directoryPath: string;
  lastModified: number;
}

// Read just enough of the file to find the "name" field without parsing the whole thing.
// Workflow JSON starts with { "version": 1, "name": "..." ... } so 1KB is plenty.
const HEAD_BYTES = 1024;

async function probeWorkflow(
  dirPath: string,
  dirName: string
): Promise<WorkflowListEntry | null> {
  try {
    const files = await fs.readdir(dirPath);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const jsonFile of jsonFiles) {
      const filePath = path.join(dirPath, jsonFile);
      try {
        const handle = await fs.open(filePath, "r");
        try {
          const buf = Buffer.alloc(HEAD_BYTES);
          const { bytesRead } = await handle.read(buf, 0, HEAD_BYTES, 0);
          const head = buf.toString("utf-8", 0, bytesRead);

          // Quick check: must look like a workflow file
          if (!head.includes('"version"') || !head.includes('"nodes"')) {
            continue;
          }

          // Extract name via regex — avoids JSON.parse on potentially huge files
          const nameMatch = head.match(/"name"\s*:\s*"([^"]*)"/);
          const name = nameMatch ? nameMatch[1] : dirName;

          const stat = await fs.stat(filePath);
          return {
            name,
            directoryPath: dirPath,
            lastModified: stat.mtimeMs,
          };
        } finally {
          await handle.close();
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Can't read directory
  }
  return null;
}

export async function GET(request: NextRequest) {
  const parentPath = request.nextUrl.searchParams.get("path");

  if (!parentPath) {
    return NextResponse.json(
      { success: false, error: "Path parameter required" },
      { status: 400 }
    );
  }

  const pathValidation = validateWorkflowPath(parentPath);
  if (!pathValidation.valid) {
    return NextResponse.json(
      { success: false, error: pathValidation.error },
      { status: 400 }
    );
  }

  try {
    const entries = await fs.readdir(parentPath, { withFileTypes: true });
    const directories = entries.filter((e) => e.isDirectory());

    // Probe all directories in parallel
    const results = await Promise.all(
      directories.map((dir) =>
        probeWorkflow(path.join(parentPath, dir.name), dir.name)
      )
    );

    const workflows = results.filter(
      (r): r is WorkflowListEntry => r !== null
    );

    // Sort by most recently modified first
    workflows.sort((a, b) => b.lastModified - a.lastModified);

    return NextResponse.json({ success: true, workflows });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to list workflows",
      },
      { status: 500 }
    );
  }
}
