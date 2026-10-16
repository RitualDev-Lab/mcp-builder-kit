import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { McpBenchmarkEngine } from "../src/benchmark.js";

describe("mcp-builder-kit Performance & Conversion Benchmark Suite", () => {
  test("generates synthetic OpenAPI specification with customizable endpoint scale", () => {
    const spec = McpBenchmarkEngine.generateMockOpenApi(5);
    assert.equal(spec.openapi, "3.0.0");
    const paths = spec.paths as Record<string, unknown>;
    assert.ok(paths["/api/v1/resource_1/{id}"]);
    assert.ok(paths["/api/v1/resource_5/{id}"]);
  });

  test("runs conversion and scaffolding benchmark within sub-50ms latency SLO", () => {
    const metrics = McpBenchmarkEngine.runBenchmark(10, 5);

    assert.equal(metrics.iterations, 10);
    assert.ok(metrics.openApiEndpointsConverted > 0);
    assert.ok(metrics.avgConversionMs >= 0);
    assert.ok(metrics.avgToolGenMs >= 0);
    assert.ok(metrics.throughputEndpointsPerSec > 0);
    assert.strictEqual(metrics.passed, true, "Benchmark must pass under latency budget");
  });
});
