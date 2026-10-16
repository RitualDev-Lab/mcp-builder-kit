import { McpCodeGenerator } from "./generator.js";
import { OpenApiToMcpConverter } from "./openapi.js";
import type { ToolDefinition } from "./types.js";

export interface McpBenchmarkMetrics {
  iterations: number;
  openApiEndpointsConverted: number;
  totalTimeMs: number;
  avgConversionMs: number;
  avgToolGenMs: number;
  throughputEndpointsPerSec: number;
  passed: boolean;
}

export const McpBenchmarkEngine = {
  /**
   * Generates a synthetic OpenAPI 3.0 specification for testing
   */
  generateMockOpenApi(endpointCount = 20): Record<string, unknown> {
    const paths: Record<string, unknown> = {};

    for (let i = 1; i <= endpointCount; i++) {
      paths[`/api/v1/resource_${i}/{id}`] = {
        get: {
          summary: `Get resource ${i} by ID`,
          description: `Retrieves detailed state of resource ${i} from backing database.`,
          operationId: `getResource_${i}`,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: `Unique identifier for resource ${i}`,
            },
            {
              name: "includeDetails",
              in: "query",
              required: false,
              schema: { type: "boolean" },
              description: "Whether to return full nested metadata",
            },
          ],
          responses: {
            "200": {
              description: "Successful lookup",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
        post: {
          summary: `Create item under resource ${i}`,
          description: `Dispatches mutation payload to resource ${i}.`,
          operationId: `createResourceItem_${i}`,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    priority: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
          },
        },
      };
    }

    return {
      openapi: "3.0.0",
      info: { title: "Benchmark Synthetic API", version: "1.0.0" },
      servers: [{ url: "https://api.benchmark.example.com" }],
      paths,
    };
  },

  /**
   * Executes high-throughput benchmark measuring OpenAPI conversion and code generation latency
   */
  runBenchmark(iterations = 25, endpointCount = 10): McpBenchmarkMetrics {
    const spec = McpBenchmarkEngine.generateMockOpenApi(endpointCount);
    const start = Date.now();

    // 1. Benchmark OpenAPI Conversion
    let totalEndpoints = 0;
    for (let i = 0; i < iterations; i++) {
      const tsResult = OpenApiToMcpConverter.convert({ spec, language: "typescript" });
      const pyResult = OpenApiToMcpConverter.convert({ spec, language: "python" });
      if (tsResult?.generatedCode && pyResult?.generatedCode) {
        totalEndpoints += endpointCount * 2;
      }
    }

    const mid = Date.now();
    const conversionTimeMs = Math.max(1, mid - start);

    // 2. Benchmark Tool Definition Generation
    const sampleTool: ToolDefinition = {
      name: "execute_benchmark_query",
      description: "Dispatches high-frequency benchmark query with schema verification",
      parameters: [
        { name: "query", type: "string", description: "SQL query string", required: true },
        { name: "maxRows", type: "number", description: "Row limit", required: false },
        { name: "dryRun", type: "boolean", description: "Dry run mode", required: false },
      ],
    };

    const toolGenStart = Date.now();
    for (let i = 0; i < iterations * 10; i++) {
      McpCodeGenerator.generateTypeScriptTool(sampleTool);
      McpCodeGenerator.generatePythonTool(sampleTool);
    }
    const toolGenTimeMs = Math.max(1, Date.now() - toolGenStart);

    const totalTimeMs = Date.now() - start;
    const avgConversionMs = conversionTimeMs / iterations;
    const avgToolGenMs = toolGenTimeMs / (iterations * 10);
    const throughputEndpointsPerSec = Math.round(totalEndpoints / (conversionTimeMs / 1000) || 0);

    return {
      iterations,
      openApiEndpointsConverted: totalEndpoints,
      totalTimeMs,
      avgConversionMs,
      avgToolGenMs,
      throughputEndpointsPerSec,
      passed: avgConversionMs < 50 && avgToolGenMs < 2,
    };
  },
};
