import assert from "node:assert";
import { describe, it } from "node:test";
import {
  convertGraphQLToTools,
  convertProtobufToTools,
  detectSchemaType,
  generateGraphQLServer,
  generateProtobufServer,
  parseGraphQLSchema,
  parseProtobufDefinition,
} from "../src/proto-graphql.js";

describe("GraphQL & gRPC / Protobuf Schema Parser Suite", () => {
  const sampleGraphQL = `
    """
    User account profile
    """
    type User {
      id: ID!
      email: String!
      displayName: String
    }

    type Query {
      """
      Fetches a user profile by unique ID
      """
      getUser(id: ID!, includeDetails: Boolean): User

      """
      Searches users by search term
      """
      searchUsers(query: String!, limit: Int): [User]
    }

    type Mutation {
      """
      Creates a new user profile
      """
      createUser(email: String!, displayName: String): User
    }
  `;

  const sampleProto = `
    syntax = "proto3";
    package ritual.vault;

    message SecretRequest {
      string key = 1;
      int32 version = 2;
      bool decrypt = 3;
    }

    message SecretResponse {
      string value = 1;
      string fingerprint = 2;
    }

    service VaultService {
      rpc GetSecret (SecretRequest) returns (SecretResponse);
      rpc RotateSecret (SecretRequest) returns (SecretResponse);
    }
  `;

  it("accurately detects schema types from content", () => {
    assert.strictEqual(detectSchemaType(sampleGraphQL), "graphql");
    assert.strictEqual(detectSchemaType(sampleProto), "protobuf");
    assert.strictEqual(
      detectSchemaType('{"openapi": "3.0.0", "info": {"title": "Test"}}'),
      "openapi",
    );
  });

  it("parses GraphQL SDL into structured operations with docstrings and args", () => {
    const ops = parseGraphQLSchema(sampleGraphQL);
    assert.strictEqual(ops.length, 3);

    const getUser = ops.find((o) => o.name === "getUser");
    assert.ok(getUser);
    assert.strictEqual(getUser.operationType, "query");
    assert.strictEqual(getUser.description, "Fetches a user profile by unique ID");
    assert.strictEqual(getUser.args.length, 2);
    assert.strictEqual(getUser.args[0].name, "id");
    assert.strictEqual(getUser.args[0].type, "string");
    assert.strictEqual(getUser.args[0].required, true);

    const createUser = ops.find((o) => o.name === "createUser");
    assert.ok(createUser);
    assert.strictEqual(createUser.operationType, "mutation");
    assert.strictEqual(createUser.args.find((a) => a.name === "email")?.required, true);
  });

  it("converts GraphQL operations into typed MCP tools with executable HTTP callers", () => {
    const tools = convertGraphQLToTools(sampleGraphQL, {
      endpoint: "https://api.example.com/graphql",
    });
    assert.strictEqual(tools.length, 3);

    const tool = tools.find((t) => t.name === "getUser");
    assert.ok(tool);
    assert.ok(tool.description.includes("Fetches a user profile by unique ID"));
    assert.ok(tool.executionCode?.includes("GRAPHQL_ENDPOINT"));
    assert.ok(tool.executionCode?.includes("fetch"));
  });

  it("parses Protobuf service definitions and extracts RPCs with input message fields", () => {
    const rpcs = parseProtobufDefinition(sampleProto);
    assert.strictEqual(rpcs.length, 2);

    const getSecret = rpcs.find((r) => r.rpcName === "GetSecret");
    assert.ok(getSecret);
    assert.strictEqual(getSecret.serviceName, "VaultService");
    assert.strictEqual(getSecret.requestMessage, "SecretRequest");
    assert.strictEqual(getSecret.responseMessage, "SecretResponse");
    assert.strictEqual(getSecret.fields.length, 3);
    assert.strictEqual(getSecret.fields[0].name, "key");
    assert.strictEqual(getSecret.fields[0].type, "string");
    assert.strictEqual(getSecret.fields[1].name, "version");
    assert.strictEqual(getSecret.fields[1].type, "number");
    assert.strictEqual(getSecret.fields[2].name, "decrypt");
    assert.strictEqual(getSecret.fields[2].type, "boolean");
  });

  it("converts Protobuf RPCs into typed MCP tools with gRPC Connect execution code", () => {
    const tools = convertProtobufToTools(sampleProto, { serviceHost: "grpc.internal:50051" });
    assert.strictEqual(tools.length, 2);

    const tool = tools.find((t) => t.name === "VaultService_GetSecret");
    assert.ok(tool);
    assert.strictEqual(tool.parameters.length, 3);
    assert.ok(tool.executionCode?.includes("GRPC_HOST"));
    assert.ok(tool.executionCode?.includes("grpc.internal:50051"));
  });

  it("generates full production MCP server source code from GraphQL SDL", () => {
    const result = generateGraphQLServer(sampleGraphQL, {
      serverName: "user-directory-graphql",
    });
    assert.strictEqual(result.tools.length, 3);
    assert.ok(result.generatedCode.includes("user-directory-graphql"));
    assert.ok(result.generatedCode.includes("handleGetUser"));
    assert.ok(result.generatedCode.includes("getUserToolDefinition"));
  });

  it("generates full production MCP server source code from Protobuf definitions", () => {
    const result = generateProtobufServer(sampleProto, {
      serverName: "vault-grpc-mcp",
    });
    assert.strictEqual(result.tools.length, 2);
    assert.ok(result.generatedCode.includes("vault-grpc-mcp"));
    assert.ok(result.generatedCode.includes("vaultServiceGetSecretToolDefinition"));
    assert.ok(result.generatedCode.includes("handleVaultServiceGetSecret"));
  });
});
