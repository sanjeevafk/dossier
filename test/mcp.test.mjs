import test from "node:test";
import assert from "node:assert/strict";
import { DossierMCPManager } from "../dist/tools/mcp.js";

test("Dossier MCP Client Manager initializes safely without crashing", async () => {
  const manager = new DossierMCPManager();
  // Initialize with empty config path for deterministic fast test
  const tools = await manager.initialize("/tmp/non-existent-dossier-mcp.json");
  assert.ok(Array.isArray(tools), "Discovered tools must be an array");
  
  // Test calling non-existent tool returns structured error instead of throwing
  const result = await manager.callTool("non_existent_tool", {});
  assert.equal(result.success, false, "Missing tool must report success=false");
  
  await manager.closeAll();
});
