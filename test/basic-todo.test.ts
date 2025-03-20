import { describe, it, expect, beforeAll } from "vitest";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { bundle, BundleResult } from "@redocly/openapi-core/lib/bundle";
import { loadConfig, makeDocumentFromString } from "@redocly/openapi-core";

import { mapSpecsToTools } from "../src/index";
import * as openApiSpec from "./fixtures/openapi-todo.json";

describe("mapSpecsToTools", () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isApiKeyPresent = typeof apiKey === "string" && apiKey.length > 0;

  const bundleResults: Array<Readonly<BundleResult>> = [];

  beforeAll(async () => {
    const config = await loadConfig({});
    const doc = makeDocumentFromString(JSON.stringify(openApiSpec), "/");

    const bundleResult = await bundle({
      doc,
      config,
      dereference: true,
    });
    bundleResults.push(bundleResult);
  });

  it("should generate a function call to create a to-do item", async () => {
    const prompt =
      "Create a to-do about submitting our new MD&I funding request!";

    const mockResponse = {
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "createTodoV1",
                    args: {
                      title: "Submit our new MD&I funding request!",
                    },
                  },
                },
              ],
              role: "model",
            },
            finishReason: "STOP",
            avgLogprobs: -0.01687342141355787,
          },
        ],
        usageMetadata: {
          promptTokenCount: 41,
          candidatesTokenCount: 14,
          totalTokenCount: 55,
          promptTokensDetails: [
            {
              modality: "TEXT",
              tokenCount: 41,
            },
          ],
          candidatesTokensDetails: [
            {
              modality: "TEXT",
              tokenCount: 14,
            },
          ],
        },
        modelVersion: "gemini-2.0-flash",
      },
    };

    const { tools } = await mapSpecsToTools({ bundleResults });

    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBeTruthy();
    expect(tools.length).toBeGreaterThan(0);
    const [firstTool] = tools;
    expect(firstTool).toBeTruthy();
    if (!firstTool) {
      throw new Error("firstTool falsy after having been asserted as truthy.");
    }

    expect(firstTool.functionDeclarations).toBeTruthy();
    if (!firstTool.functionDeclarations) {
      throw new Error(
        "firstTool.functionDeclarations falsy after asserted as truthy."
      );
    }
    expect(Array.isArray(firstTool.functionDeclarations)).toBeTruthy();
    const { functionDeclarations } = firstTool;
    expect(functionDeclarations.length).toBe(7);

    // Operation: getTodosV1
    const fdGetTodosV1 = functionDeclarations.find(
      (fd) => fd.name === "getTodosV1"
    );
    expect(fdGetTodosV1).toBeDefined();
    if (!fdGetTodosV1) {
      throw new Error("fdGetTodosV1 falsy, was asserted as truthy.");
    }

    expect(fdGetTodosV1.name).toBe("getTodosV1");
    expect(fdGetTodosV1.parameters).not.toBeDefined();

    // Operation: createTodoV1
    const fdCreateTodoV1 = functionDeclarations.find(
      (fd) => fd.name === "createTodoV1"
    );
    expect(fdCreateTodoV1).toBeDefined();
    if (!fdCreateTodoV1) {
      throw new Error("fdCreateTodoV1 falsy, was asserted as truthy.");
    }

    expect(fdCreateTodoV1.name).toBe("createTodoV1");
    expect(fdCreateTodoV1.parameters).toBeTypeOf("object");

    if (!fdCreateTodoV1.parameters) {
      throw new Error("fdCreateTodoV1.parameters falsy, asserted as truthy.");
    }

    expect(fdCreateTodoV1.parameters.type).toBeTypeOf("string");
    expect(fdCreateTodoV1.parameters.description).toBeTypeOf("string");
    expect(fdCreateTodoV1.parameters.properties).toBeTypeOf("object");

    let response;
    if (isApiKeyPresent) {
      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

      const output = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools,
      });
      response = output.response;
    } else {
      response = mockResponse.response;
    }

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("response falsy, was asserted as truthy.");
    }
    expect(response.candidates).toBeDefined();
    if (!response.candidates) {
      throw new Error("response.candidates falsy, was asserted as truthy.");
    }
    expect(Array.isArray(response.candidates)).toBeTruthy();
    expect(response.candidates.length).toBeGreaterThan(0);

    const [firstCandidate] = response.candidates;
    expect(firstCandidate).toBeTruthy();
    if (!firstCandidate) {
      throw new Error("firstCandidate falsy, was asserted as truthy.");
    }
    expect(firstCandidate.content).toBeDefined();
    expect(firstCandidate.content.parts).toBeDefined();
    expect(Array.isArray(firstCandidate.content.parts)).toBeTruthy();
    expect(firstCandidate.content.parts.length).toBeGreaterThan(0);

    const [firstPart] = firstCandidate.content.parts;
    expect(firstPart).toBeTruthy();
    if (!firstPart) {
      throw new Error("firstPart falsy, was asserted as truthy.");
    }
    expect(firstPart.functionCall).toBeDefined();
    expect(typeof firstPart.functionCall).toBe("object");
    if (!firstPart.functionCall) {
      throw new Error("firstPart.functionCall falsy, asserted as truthy.");
    }
    expect(firstPart.functionCall.name).toBe("createTodoV1");
    expect(firstPart.functionCall.args).toBeDefined();
    expect(typeof firstPart.functionCall.args).toBe("object");
    if (!firstPart.functionCall.args) {
      throw new Error("firstPart.functionCall.args falsy, asserted as truthy.");
    }
    if (!("title" in firstPart.functionCall.args)) {
      throw new Error("firstPart.functionCall.args.title assert/runtime diff");
    }
    expect(firstPart.functionCall.args.title).toBeDefined();
    expect(firstPart.functionCall.args.title).toBeTypeOf("string");
    expect(firstPart.functionCall.args.title.length).toBeGreaterThan(5);
  });

  it("maps to a function call to create a to-do wrapper wrapper", async () => {
    const fnName = "createTodoWrapperWrapperV1";
    const tww = {
      todoWrapper: {
        createdAt: new Date().toJSON(),
        todo: {
          id: 42,
          title: "Invent AGI",
        },
      },
      updatedAt: new Date().toJSON(),
    };
    const twwJson = JSON.stringify(tww);
    const prompt = `Create a TodoWrapperWrapper. The input should look like this: ${twwJson}`;
    const mockResponse = {
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "createTodoWrapperWrapperV1",
                    args: {
                      todoWrapper: {
                        createdAt: "2025-03-17T05:50:36.687Z",
                        todo: { title: "Invent AGI", id: 42 },
                      },
                      updatedAt: "2025-03-17T05:50:36.688Z",
                    },
                  },
                },
              ],
              role: "model",
            },
            finishReason: "STOP",
            avgLogprobs: -0.0037721097469329834,
          },
        ],
        usageMetadata: {
          promptTokenCount: 259,
          candidatesTokenCount: 64,
          totalTokenCount: 323,
          promptTokensDetails: [{ modality: "TEXT", tokenCount: 259 }],
          candidatesTokensDetails: [{ modality: "TEXT", tokenCount: 64 }],
        },
        modelVersion: "gemini-2.0-flash",
      },
    };

    const { tools } = await mapSpecsToTools({ bundleResults });

    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBeTruthy();
    expect(tools.length).toBeGreaterThan(0);
    const [firstTool] = tools;
    expect(firstTool).toBeTruthy();
    if (!firstTool) {
      throw new Error("firstTool falsy after having been asserted as truthy.");
    }

    expect(firstTool.functionDeclarations).toBeTruthy();
    if (!firstTool.functionDeclarations) {
      throw new Error(
        "firstTool.functionDeclarations falsy after asserted as truthy."
      );
    }
    expect(Array.isArray(firstTool.functionDeclarations)).toBeTruthy();
    const { functionDeclarations } = firstTool;
    expect(functionDeclarations.length).toBe(7);

    const fd = functionDeclarations.find((fd) => fd.name === fnName);
    expect(fd).toBeDefined();
    if (!fd) {
      throw new Error("fd falsy, was asserted as truthy.");
    }

    expect(fd.name).toBe(fnName);
    expect(fd.parameters).toBeTypeOf("object");

    if (!fd.parameters) {
      throw new Error("fd.parameters falsy, asserted as truthy.");
    }

    expect(fd.parameters.type).toBeTypeOf("string");
    expect(fd.parameters.description).toBeTypeOf("string");
    expect(fd.parameters.properties).toBeTypeOf("object");

    let response;
    if (isApiKeyPresent) {
      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

      const output = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools,
      });
      response = output.response;
    } else {
      response = mockResponse.response;
    }

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("response falsy, was asserted as truthy.");
    }
    expect(response.candidates).toBeDefined();
    if (!response.candidates) {
      throw new Error("response.candidates falsy, was asserted as truthy.");
    }
    expect(Array.isArray(response.candidates)).toBeTruthy();
    expect(response.candidates.length).toBeGreaterThan(0);

    const [firstCandidate] = response.candidates;
    expect(firstCandidate).toBeTruthy();
    if (!firstCandidate) {
      throw new Error("firstCandidate falsy, was asserted as truthy.");
    }
    expect(firstCandidate.content).toBeDefined();
    expect(firstCandidate.content.parts).toBeDefined();
    expect(Array.isArray(firstCandidate.content.parts)).toBeTruthy();
    expect(firstCandidate.content.parts.length).toBeGreaterThan(0);

    const [firstPart] = firstCandidate.content.parts;
    expect(firstPart).toBeTruthy();
    if (!firstPart) {
      throw new Error("firstPart falsy, was asserted as truthy.");
    }
    expect(firstPart.functionCall).toBeDefined();
    expect(typeof firstPart.functionCall).toBe("object");
    if (!firstPart.functionCall) {
      throw new Error("firstPart.functionCall falsy, asserted as truthy.");
    }
    expect(firstPart.functionCall.name).toBe(fnName);
    expect(firstPart.functionCall.args).toBeDefined();
    expect(typeof firstPart.functionCall.args).toBe("object");
    if (!firstPart.functionCall.args) {
      throw new Error("firstPart.functionCall.args falsy, asserted as truthy.");
    }
    if (!("updatedAt" in firstPart.functionCall.args)) {
      throw new Error(
        "firstPart.functionCall.args.updatedAt assert/runtime diff"
      );
    }
    const { functionCall: fnc } = firstPart;
    expect(fnc.args.updatedAt).toBeDefined();
    expect(fnc.args.updatedAt).toBeTypeOf("string");
    expect(fnc.args.updatedAt.length).toBeGreaterThan(5);

    expect(fnc.args.todoWrapper).toBeDefined();
    expect(fnc.args.todoWrapper).toBeTypeOf("object");

    expect(fnc.args.todoWrapper.createdAt).toBeDefined();
    expect(fnc.args.todoWrapper.createdAt).toBeTypeOf("string");
    expect(fnc.args.todoWrapper.createdAt).not.toHaveLength(5);

    expect(fnc.args.todoWrapper.todo).toBeDefined();
    expect(fnc.args.todoWrapper.todo).toBeTypeOf("object");

    expect(fnc.args.todoWrapper.todo.id).toBeDefined();
    expect(fnc.args.todoWrapper.todo.id).toBeTypeOf("number");
    expect(fnc.args.todoWrapper.todo.id).toBe(42);

    expect(fnc.args.todoWrapper.todo.title).toBeDefined();
    expect(fnc.args.todoWrapper.todo.title).toBeTypeOf("string");
    expect(fnc.args.todoWrapper.todo.title).not.toHaveLength(0);
  });
});
