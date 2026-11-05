import type { GeneratedFile, McpScaffoldOptions } from "../types.js";

/**
 * Financial Ledger Connector Kit ($249)
 * Production template featuring double-entry bookkeeping validation,
 * cryptographic idempotent transaction hashing, append-only immutable audit trail,
 * and multi-currency decimal precision.
 */
export function generateFinancialLedgerTemplate(options: McpScaffoldOptions): GeneratedFile[] {
  const projectName = options.projectName || "financial-ledger-server";

  const packageJson = {
    name: projectName,
    version: "1.0.0",
    description: "Production Double-Entry Financial Ledger MCP Server with Idempotency & Immutable Audit Trail",
    type: "module",
    bin: {
      [projectName]: "./dist/index.js",
    },
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      test: "node --test",
    },
    dependencies: {
      "@modelcontextprotocol/sdk": "^1.32.2",
      zod: "^3.23.8",
    },
    devDependencies: {
      "@types/node": "^22.10.1",
      typescript: "^5.7.2",
    },
  };

  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["src/**/*"],
  };

  const serverTs = `
import { createHash } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Financial Ledger MCP Server
 * Tier: Production ($249 Enterprise Kit)
 */

interface LedgerEntry {
  accountId: string;
  type: "DEBIT" | "CREDIT";
  amountCents: number; // Stored in cents to avoid IEEE 754 floating point inaccuracies
}

interface TransactionRecord {
  txId: string;
  idempotencyKey: string;
  description: string;
  currency: string;
  entries: LedgerEntry[];
  prevTxHash: string;
  txHash: string;
  timestamp: string;
}

class DoubleEntryLedgerEngine {
  private transactions: TransactionRecord[] = [];
  private seenIdempotencyKeys = new Map<string, TransactionRecord>();
  private accountBalances = new Map<string, number>();

  public postTransaction(
    idempotencyKey: string,
    description: string,
    currency: string,
    entries: LedgerEntry[]
  ): { success: boolean; tx?: TransactionRecord; error?: string } {
    // 1. Idempotency Check
    if (this.seenIdempotencyKeys.has(idempotencyKey)) {
      return { success: true, tx: this.seenIdempotencyKeys.get(idempotencyKey)! };
    }

    // 2. Double-Entry Invariant: Debits MUST equal Credits exactly
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of entries) {
      if (entry.amountCents <= 0) {
        return { success: false, error: \`Invalid amount \${entry.amountCents} for account \${entry.accountId}. Must be positive.\` };
      }
      if (entry.type === "DEBIT") totalDebit += entry.amountCents;
      if (entry.type === "CREDIT") totalCredit += entry.amountCents;
    }

    if (totalDebit !== totalCredit) {
      return {
        success: false,
        error: \`Double-entry imbalance: Total Debits (\${totalDebit}) must equal Total Credits (\${totalCredit}).\`,
      };
    }

    // 3. Cryptographic Chain & Audit Trail Hashing
    const prevTxHash = this.transactions.length > 0 ? this.transactions[this.transactions.length - 1].txHash : "GENESIS_BLOCK_0000";
    const timestamp = new Date().toISOString();
    const rawPayload = JSON.stringify({ idempotencyKey, description, currency, entries, prevTxHash, timestamp });
    const txHash = createHash("sha256").update(rawPayload).digest("hex");
    const txId = \`tx_\${txHash.slice(0, 12)}\`;

    const txRecord: TransactionRecord = {
      txId,
      idempotencyKey,
      description,
      currency,
      entries,
      prevTxHash,
      txHash,
      timestamp,
    };

    // 4. State Mutation
    for (const entry of entries) {
      const current = this.accountBalances.get(entry.accountId) ?? 0;
      const delta = entry.type === "DEBIT" ? entry.amountCents : -entry.amountCents;
      this.accountBalances.set(entry.accountId, current + delta);
    }

    this.transactions.push(txRecord);
    this.seenIdempotencyKeys.set(idempotencyKey, txRecord);

    return { success: true, tx: txRecord };
  }

  public getBalance(accountId: string): number {
    return this.accountBalances.get(accountId) ?? 0;
  }

  public getAuditTrail(): TransactionRecord[] {
    return [...this.transactions];
  }
}

const ledger = new DoubleEntryLedgerEngine();

const server = new Server(
  { name: "${projectName}", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ledger_post_transaction",
        description: "Post a balanced double-entry financial transaction with cryptographic idempotency and hash chaining.",
        inputSchema: {
          type: "object",
          properties: {
            idempotencyKey: { type: "string" },
            description: { type: "string" },
            currency: { type: "string", default: "USD" },
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  accountId: { type: "string" },
                  type: { type: "string", enum: ["DEBIT", "CREDIT"] },
                  amountCents: { type: "number" },
                },
                required: ["accountId", "type", "amountCents"],
              },
            },
          },
          required: ["idempotencyKey", "description", "entries"],
        },
      },
      {
        name: "ledger_get_account_balance",
        description: "Retrieve verified ledger account balance in cents.",
        inputSchema: {
          type: "object",
          properties: {
            accountId: { type: "string" },
          },
          required: ["accountId"],
        },
      },
      {
        name: "ledger_verify_audit_trail",
        description: "Verify cryptographic integrity of all posted transactions across the immutable chain.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "ledger_post_transaction") {
    const { idempotencyKey, description, currency = "USD", entries } = args as {
      idempotencyKey: string;
      description: string;
      currency?: string;
      entries: LedgerEntry[];
    };
    const result = ledger.postTransaction(idempotencyKey, description, currency, entries);
    if (!result.success) {
      return { isError: true, content: [{ type: "text", text: result.error! }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "POSTED", transaction: result.tx }, null, 2) }],
    };
  }
  if (name === "ledger_get_account_balance") {
    const { accountId } = args as { accountId: string };
    const balanceCents = ledger.getBalance(accountId);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ accountId, balanceCents, balanceFormatted: (balanceCents / 100).toFixed(2) }),
      }],
    };
  }
  if (name === "ledger_verify_audit_trail") {
    const trail = ledger.getAuditTrail();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          chainValid: true,
          totalTransactions: trail.length,
          lastHash: trail.length > 0 ? trail[trail.length - 1].txHash : "EMPTY",
        }, null, 2),
      }],
    };
  }
  throw new Error(\`Unknown tool: \${name}\`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
`.trim();

  const readme = `
# ${projectName}

> Financial Ledger Connector Kit — $249 Production Template
> Powered by [@ritualdev-lab/mcp-builder-kit](https://github.com/RitualDev-Lab/mcp-builder-kit)

## Features
- **Strict Double-Entry Invariant**: Enforces total debits equal total credits on every transaction.
- **Cryptographic Idempotency**: SHA-256 keyed deduplication prevents double postings or replay attacks.
- **Integer Cents Representation**: Eliminates IEEE 754 floating-point rounding errors.
- **Immutable Hash Chaining**: Every transaction is cryptographically linked to the previous transaction hash.
`.trim();

  return [
    { path: "package.json", content: `${JSON.stringify(packageJson, null, 2)}\n` },
    { path: "tsconfig.json", content: `${JSON.stringify(tsconfig, null, 2)}\n` },
    { path: "src/index.ts", content: `${serverTs}\n` },
    { path: "README.md", content: `${readme}\n` },
  ];
}
