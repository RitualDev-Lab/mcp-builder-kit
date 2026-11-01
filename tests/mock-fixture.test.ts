import assert from "node:assert";
import { describe, it } from "node:test";
import {
  generateFixtureFile,
  generateMockArguments,
  generateMockToolResponse,
  generateSyntheticMockData,
  runMockSandboxTest,
} from "../src/mock-fixture.js";
import type { ToolDefinition } from "../src/types.js";

describe("Mock Sandbox Fixture Mode Suite", () => {
  const sampleTools: ToolDefinition[] = [
    {
      name: "getUserProfile",
      description: "Returns user account details",
      parameters: [
        { name: "userId", type: "string", required: true },
        { name: "email", type: "string", required: true },
        { name: "limit", type: "number", required: false },
      ],
    },
    {
      name: "createPaymentIntent",
      description: "Generates checkout charge intent",
      parameters: [
        { name: "amount", type: "number", required: true },
        { name: "currency", type: "string", required: true },
        { name: "isExpress", type: "boolean", required: false },
        {
          name: "metadata",
          type: "object",
          required: false,
        },
      ],
    },
  ];

  it("generates realistic synthetic mock data matching semantic heuristics", () => {
    assert.ok(
      String(generateSyntheticMockData({ name: "user_email", type: "string" })).includes("@"),
    );
    assert.strictEqual(
      generateSyntheticMockData({ name: "userId", type: "string" }),
      "018f2b3c-4d5e-7a8b-9c0d-1e2f3a4b5c6d",
    );
    assert.strictEqual(generateSyntheticMockData({ name: "amount", type: "number" }), 49.99);
    assert.strictEqual(generateSyntheticMockData({ name: "currency", type: "string" }), "USD");
    assert.strictEqual(
      generateSyntheticMockData({ name: "createdAt", type: "string" }),
      "2026-11-01T12:00:00.000Z",
    );
    assert.strictEqual(generateSyntheticMockData({ name: "isVerified", type: "boolean" }), true);
  });

  it("synthesizes valid mock argument objects for tool definitions", () => {
    const args = generateMockArguments(sampleTools[0]);
    assert.ok(args.userId);
    assert.ok(String(args.email).includes("@"));
    assert.strictEqual(typeof args.limit, "number");
  });

  it("generates realistic synthetic mock response payloads", () => {
    const mockArgs = { userId: "user-123", email: "test@example.com" };
    const response = generateMockToolResponse(sampleTools[0], mockArgs);

    assert.ok(response.content.length > 0);
    const parsed = JSON.parse(response.content[0].text);
    assert.strictEqual(parsed._status, "success");
    assert.strictEqual(parsed._mockFixture, true);
    assert.strictEqual(parsed.tool, "getUserProfile");
    assert.deepStrictEqual(parsed.receivedArgs, mockArgs);
  });

  it("runs in-memory mock sandbox suite and reports latency & pass rate", async () => {
    const summary = await runMockSandboxTest(sampleTools);

    assert.strictEqual(summary.totalTools, 2);
    assert.strictEqual(summary.passed, 2);
    assert.strictEqual(summary.failed, 0);
    assert.ok(summary.avgLatencyMs >= 0);
    assert.strictEqual(summary.results.length, 2);
    assert.strictEqual(summary.results[0].passed, true);
  });

  it("generates an exportable fixture file for offline integration testing", () => {
    const fixtures = generateFixtureFile(sampleTools);

    assert.ok(fixtures.getUserProfile);
    assert.ok(fixtures.createPaymentIntent);
    assert.ok(fixtures.getUserProfile.mockArgs.userId);
    assert.strictEqual((fixtures.getUserProfile.expectedOutput as any)._mockFixture, true);
  });
});
