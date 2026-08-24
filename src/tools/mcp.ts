import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import path from "node:path";

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  description?: string;
}

export interface MCPConfigFile {
  mcpServers: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
    description?: string;
  }>;
}

export interface DiscoveredTool {
  serverName: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export class DossierMCPManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private discoveredTools: DiscoveredTool[] = [];
  private isInitialized = false;

  /**
   * Load MCP configuration from `dossier.mcp.json` or fallback defaults.
   */
  public async initialize(configPath?: string): Promise<DiscoveredTool[]> {
    if (this.isInitialized) {
      return this.discoveredTools;
    }

    const targetConfig = configPath || path.resolve(process.cwd(), "dossier.mcp.json");
    const configs: Record<string, MCPServerConfig> = {};

    if (fs.existsSync(targetConfig)) {
      try {
        const raw = fs.readFileSync(targetConfig, "utf-8");
        const parsed: MCPConfigFile = JSON.parse(raw);
        for (const [key, val] of Object.entries(parsed.mcpServers || {})) {
          configs[key] = {
            name: key,
            command: val.command,
            args: val.args || [],
            env: val.env,
            description: val.description
          };
        }
      } catch (err: any) {
        console.warn(`[MCP] Failed to parse ${targetConfig}:`, err.message);
      }
    }

    // Connect to each configured MCP server
    for (const [serverName, cfg] of Object.entries(configs)) {
      try {
        const cleanEnv: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (typeof v === "string") cleanEnv[k] = v;
        }
        for (const [k, v] of Object.entries(cfg.env || {})) {
          if (typeof v === "string") cleanEnv[k] = v;
        }

        const transport = new StdioClientTransport({
          command: cfg.command,
          args: cfg.args,
          env: cleanEnv
        });

        const client = new Client(
          {
            name: `dossier-harness-${serverName}`,
            version: "1.0.0"
          },
          {
            capabilities: {}
          }
        );

        await client.connect(transport);
        this.clients.set(serverName, client);
        this.transports.set(serverName, transport);

        // List discovered tools
        const toolsResult = await client.listTools();
        for (const t of toolsResult.tools) {
          this.discoveredTools.push({
            serverName,
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema as Record<string, any> | undefined
          });
        }
      } catch (err: any) {
        console.warn(`[MCP] Failed to connect to server "${serverName}":`, err.message);
      }
    }

    this.isInitialized = true;
    return this.discoveredTools;
  }

  /**
   * Execute an MCP tool by name across connected servers.
   */
  public async callTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    for (const [serverName, client] of this.clients.entries()) {
      try {
        const res = await client.callTool({
          name: toolName,
          arguments: args
        });
        return {
          success: true,
          server: serverName,
          result: res
        };
      } catch {
        // Try next server if not found
      }
    }

    return {
      success: false,
      error: `Tool "${toolName}" not found on any connected MCP server.`
    };
  }

  /**
   * List all currently active MCP tools.
   */
  public getTools(): DiscoveredTool[] {
    return this.discoveredTools;
  }

  /**
   * Check if any MCP servers are currently connected.
   */
  public hasActiveServers(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Gracefully close all MCP transports.
   */
  public async closeAll(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        await client.close();
      } catch {}
    }
    this.clients.clear();
    this.transports.clear();
    this.discoveredTools = [];
    this.isInitialized = false;
  }
}

export const mcpManager = new DossierMCPManager();
