import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, beforeAll } from "vitest";

import { bundle, BundleResult } from "@redocly/openapi-core/lib/bundle";
import { loadConfig, makeDocumentFromString } from "@redocly/openapi-core";

import { mapSpecsToTools, OperationTypeNames } from "../src/index";

interface IFileData {
  readonly name: string;
  readonly path: string;
  readonly data: Buffer;
}

async function readFilesFromDir(
  directory: string = "./fixtures/"
): Promise<ReadonlyArray<IFileData>> {
  try {
    const __dirname = new URL(".", import.meta.url).pathname;
    directory = path.join(__dirname, directory);
    const files = await fs.readdirSync(directory);
    const fileObjects = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directory, file);
        const data = await fs.readFileSync(filePath);
        return Object.freeze({
          name: file,
          path: filePath,
          data,
        });
      })
    );
    return Object.freeze(fileObjects);
  } catch (cause) {
    console.error(`Error reading directory ${directory}:`, cause);
    const ctx = { directory, cause };
    throw new Error("[readFilesFromDir] readdir failed:", ctx);
  }
}

describe("mapSpecsToTools", () => {
  const bundleResults: Array<Readonly<BundleResult>> = [];

  beforeAll(async () => {
    const files = await readFilesFromDir();
    const docs = files.map(({ data }) =>
      makeDocumentFromString(data.toString("utf-8"), "/")
    );

    const config = await loadConfig({});
    const dereference = true;
    await Promise.all(
      docs.map(async (doc) =>
        bundle({ doc, config, dereference }).then((br) =>
          bundleResults.push(br)
        )
      )
    );
  });

  it("should generate a function call for each spec in the test set", async () => {
    const { tools, map } = await mapSpecsToTools({ bundleResults });

    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBeTruthy();
    expect(tools.length).toEqual(bundleResults.length);

    expect(map.size).toEqual(bundleResults.length);
    expect(map.size).toEqual(tools.length);

    for (const [tool, openApiCtx] of map.entries()) {
      const { bundleResult, title } = openApiCtx;
      const {
        info: { version },
      } = bundleResult.bundle.parsed;
      const fnCount = tool.functionDeclarations
        ? tool.functionDeclarations.length
        : 0;

      const rootCtx = { fnCount, title, version };
      const rootCtxJson = JSON.stringify(rootCtx);
      expect(tool, rootCtxJson).toBeDefined();
      expect(bundleResult, rootCtxJson).toBeDefined();

      expect(bundleResult.bundle.parsed.paths, rootCtxJson).toBeDefined();
      expect(bundleResult.bundle.parsed.paths, rootCtxJson).toBeTypeOf(
        "object"
      );
      expect(bundleResult.bundle.parsed.paths, rootCtxJson).toBeTypeOf(
        "object"
      );
      const pathKeys = Object.keys(bundleResult.bundle.parsed.paths);
      expect(pathKeys.length, rootCtxJson).toBeGreaterThan(0);

      // sums up all the operations of all the paths (each path can have multiple HTTP verbs)
      const operationCount = Object.entries(
        bundleResult.bundle.parsed.paths
      ).flatMap(([_, pathPojo]) =>
        Object.keys(pathPojo as any).filter((key) =>
          OperationTypeNames.includes(key)
        )
      ).length;

      const { functionDeclarations } = tool;
      expect(tool.functionDeclarations, rootCtxJson).toBeTypeOf("object");
      if (!functionDeclarations) {
        throw new Error("functionDeclarations falsy vs asserted as truthy.");
      }

      if (!Array.isArray(functionDeclarations)) {
        throw new Error("functionDeclarations not an array vs asserted as");
      }

      expect(
        Array.isArray(tool.functionDeclarations),
        rootCtxJson
      ).toBeTruthy();
      expect(functionDeclarations.length, rootCtxJson).toEqual(operationCount);

      const fnNames = functionDeclarations.map((fd) => fd.name);
      expect(fnNames.length, rootCtxJson).toEqual(operationCount);

      const allFunctionNamesAreNonBlankStrings = fnNames.every(
        (fn) => typeof fn === "string" && fn.length > 0
      );
      expect(allFunctionNamesAreNonBlankStrings, rootCtxJson).toBe(true);

      for (const fd of functionDeclarations) {
        const ctxJson = JSON.stringify({ ...rootCtx, fd }, null);
        expect(fd.name, ctxJson).toBeDefined();
        expect(fd.name, ctxJson).toBeTypeOf("string");
        expect(fd.name.length, ctxJson).toBeGreaterThan(0);

        expect(fd.description, ctxJson).toBeTypeOf("string");
        expect(fd.description?.length, ctxJson).toBeGreaterThan(0);

        const listOfOperationsWithNoActualParameters = [
          "getTodosV1",
          "todosOptions",
          "todosIdGet",
          "apiOtherArgTodosIdGet",
        ];
        if (listOfOperationsWithNoActualParameters.includes(fd.name)) {
          expect(fd.parameters, ctxJson).toBeUndefined();
          continue;
        }

        expect(fd.parameters, ctxJson).toBeDefined();
        expect(fd.parameters, ctxJson).toBeTypeOf("object");
        if (!fd.parameters) {
          throw new Error("fd.parameters falsy, asserted as truthy.");
        }

        expect(fd.parameters.type, ctxJson).toBeTypeOf("string");
        expect(fd.parameters.description, ctxJson).toBeTypeOf("string");
        expect(fd.parameters.description, ctxJson).not.toContain(
          "No summary nor description."
        );
        expect(fd.parameters.properties, ctxJson).toBeTypeOf("object");

        const fdParamPropLength = Object.keys(fd.parameters.properties).length;
        expect(fdParamPropLength, ctxJson).toBeGreaterThan(0);
      }
    }
  });

  it("maps AWS > SES > GET_SendEmail correctly", async () => {
    const [brAwsSes] = bundleResults.filter(
      (br) => br.bundle.parsed.info.title === "Amazon Simple Email Service"
    );
    expect(brAwsSes).toBeTruthy();
    expect(brAwsSes).toBeTypeOf("object");
    const { tools } = await mapSpecsToTools({ bundleResults: [brAwsSes] });
    expect(tools).toBeTruthy();
    expect(tools.length).toEqual(1);
    const [tool] = tools;
    expect(tool).toBeTruthy();
    expect(tool).toBeTypeOf("object");

    const { functionDeclarations } = tool;
    if (!functionDeclarations) {
      throw new Error("tool.functionDeclarations falsy, asserted as truthy.");
    }
    expect(functionDeclarations).toBeTruthy();
    expect(Array.isArray(functionDeclarations)).toBeTruthy();
    expect(functionDeclarations.length).toBe(142);

    const allFdNames = functionDeclarations.map((fd) => fd.name);
    expect(allFdNames.length).toEqual(142);
    const ctxJson = JSON.stringify({ allFdNames });

    const fdSendEmail = functionDeclarations.find(
      (fd) => fd.name === "GET_SendEmail"
    );
    expect(fdSendEmail, ctxJson).toBeTruthy();
    if (!fdSendEmail) {
      throw new Error("fdSendEmail falsy, asserted as truthy.");
    }

    const { description: fdDescription, parameters } = fdSendEmail;

    expect(fdDescription).toBeTruthy();
    expect(fdDescription).toBeTypeOf("string");
    expect(fdDescription).include(
      "Composes an email message and immediately queues it for sending. "
    );
    expect(fdDescription).include(
      "The message must be sent from a verified email address or domain."
    );
    expect(fdDescription).include(
      "The message may not include more than 50 recipients, across the To:, CC: and BCC: fields."
    );

    expect(parameters).toBeTruthy();
    expect(parameters).toBeTypeOf("object");
    if (!parameters) {
      throw new Error("parameters falsy, asserted as truthy.");
    }

    const { properties, type, description, required } = parameters;
    expect(type).toBeTypeOf("string");
    expect(description).toBeTypeOf("string");
    expect(properties).toBeTruthy();
    expect(properties).toBeTypeOf("object");
    expect(properties).toHaveProperty("Action");
    expect(properties).toHaveProperty("Version");
    expect(properties).toHaveProperty("X-Amz-Content-Sha256");
    expect(properties).toHaveProperty("X-Amz-Date");
    expect(properties).toHaveProperty("X-Amz-Algorithm");
    expect(properties).toHaveProperty("X-Amz-Credential");
    expect(properties).toHaveProperty("X-Amz-Security-Token");
    expect(properties).toHaveProperty("X-Amz-Signature");
    expect(properties).toHaveProperty("X-Amz-SignedHeaders");

    const ctxAction = JSON.stringify(properties.Action);
    expect(properties.Action, ctxAction).toHaveProperty("name");
    expect(properties.Action.name, ctxAction).toBeTypeOf("string");
    expect(properties.Action.name, ctxAction).not.toHaveLength(0);

    expect(properties.Action, ctxAction).toHaveProperty("description");
    expect(properties.Action.description, ctxAction).toBeTypeOf("string");
    expect(properties.Action.description, ctxAction).not.toHaveLength(0);

    expect(properties.Action, ctxAction).toHaveProperty("type");
    expect(properties.Action.type, ctxAction).toBeTypeOf("string");
    expect(properties.Action.type, ctxAction).not.toHaveLength(0);

    expect(required).toBeTruthy();
    expect(Array.isArray(required)).toBe(true);
    expect(required?.length).toBe(5);
    expect(required).toContain("Action");
    expect(required).toContain("Version");
    expect(required).toContain("Source");
    expect(required).toContain("Destination");
    expect(required).toContain("Message");
  });

  it("maps AWS > SES > POST_SendEmail correctly", async () => {
    const [brAwsSes] = bundleResults.filter(
      (br) => br.bundle.parsed.info.title === "Amazon Simple Email Service"
    );
    expect(brAwsSes).toBeTruthy();
    expect(brAwsSes).toBeTypeOf("object");
    const { tools } = await mapSpecsToTools({ bundleResults: [brAwsSes] });
    expect(tools).toBeTruthy();
    expect(tools.length).toEqual(1);
    const [tool] = tools;
    expect(tool).toBeTruthy();
    expect(tool).toBeTypeOf("object");

    const { functionDeclarations } = tool;
    if (!functionDeclarations) {
      throw new Error("tool.functionDeclarations falsy, asserted as truthy.");
    }
    expect(functionDeclarations).toBeTruthy();
    expect(Array.isArray(functionDeclarations)).toBeTruthy();
    expect(functionDeclarations.length).toBe(142);

    const allFdNames = functionDeclarations.map((fd) => fd.name);
    expect(allFdNames.length).toEqual(142);
    const ctxJson = JSON.stringify({ allFdNames });

    const fdSendEmail = functionDeclarations.find(
      (fd) => fd.name === "POST_SendEmail"
    );
    expect(fdSendEmail, ctxJson).toBeTruthy();
    if (!fdSendEmail) {
      throw new Error("fdSendEmail falsy, asserted as truthy.");
    }

    const { description: fdDescription, parameters } = fdSendEmail;

    expect(fdDescription).toBeTruthy();
    expect(fdDescription).toBeTypeOf("string");
    expect(fdDescription).include(
      "Composes an email message and immediately queues it for sending. "
    );
    expect(fdDescription).include(
      "The message must be sent from a verified email address or domain."
    );
    expect(fdDescription).include(
      "The message may not include more than 50 recipients, across the To:, CC: and BCC: fields."
    );

    expect(parameters).toBeTruthy();
    expect(parameters).toBeTypeOf("object");
    if (!parameters) {
      throw new Error("parameters falsy, asserted as truthy.");
    }

    const { properties, type, description, required } = parameters;
    expect(type).toBeTypeOf("string");
    expect(description).toBeTypeOf("string");

    expect(properties).toBeTruthy();
    expect(properties).toBeTypeOf("object");
    expect(properties).toHaveProperty("Action");
    expect(properties).toHaveProperty("Version");
    expect(properties).toHaveProperty("X-Amz-Content-Sha256");
    expect(properties).toHaveProperty("X-Amz-Date");
    expect(properties).toHaveProperty("X-Amz-Algorithm");
    expect(properties).toHaveProperty("X-Amz-Credential");
    expect(properties).toHaveProperty("X-Amz-Security-Token");
    expect(properties).toHaveProperty("X-Amz-Signature");
    expect(properties).toHaveProperty("X-Amz-SignedHeaders");

    expect(required).toBeTruthy();
    expect(Array.isArray(required)).toBe(true);
    expect(required?.length).toBe(2);
    expect(required).toContain("Action");
    expect(required).toContain("Version");
  });

  it("maps Google > Calendar > calendar.events.insert correctly", async () => {
    const [br] = bundleResults.filter(
      (br) =>
        br.bundle.parsed.info.title === "Calendar API" &&
        br.bundle.parsed.info.version === "v3" &&
        br.bundle.parsed.info.contact.name === "Google"
    );
    expect(br).toBeTruthy();
    expect(br).toBeTypeOf("object");
    const { tools } = await mapSpecsToTools({ bundleResults: [br] });
    expect(tools).toBeTruthy();
    expect(tools.length).toEqual(1);
    const [tool] = tools;
    expect(tool).toBeTruthy();
    expect(tool).toBeTypeOf("object");

    const { functionDeclarations: fds } = tool;
    if (!fds) {
      throw new Error("tool.functionDeclarations falsy, asserted as truthy.");
    }
    expect(fds).toBeTruthy();
    expect(Array.isArray(fds)).toBeTruthy();
    expect(fds.length).toBe(37);

    const allFdNames = fds.map((fd) => fd.name);
    expect(allFdNames.length).toEqual(37);
    const ctxJson = JSON.stringify({ allFdNames });

    const fd = fds.find((fd) => fd.name === "calendar.events.insert");
    expect(fd, ctxJson).toBeTruthy();
    if (!fd) {
      throw new Error("fd falsy, asserted as truthy.");
    }

    const { description: fdDescription, parameters } = fd;

    expect(fdDescription).toBeTruthy();
    expect(fdDescription).toBeTypeOf("string");
    expect(fdDescription).include("Creates an event.");

    expect(parameters).toBeTruthy();
    expect(parameters).toBeTypeOf("object");
    if (!parameters) {
      throw new Error("parameters falsy, asserted as truthy.");
    }

    const { properties, type, description, required } = parameters;
    expect(type).toBeTypeOf("string");
    expect(description).toBeTypeOf("string");

    expect(properties).toBeTruthy();
    expect(properties).toBeTypeOf("object");
    expect(properties).toHaveProperty("calendarId");

    expect(required).toBeTruthy();
    expect(Array.isArray(required)).toBe(true);
    expect(required?.length).toBe(1);
    expect(required).toContain("calendarId");
  });

  it("maps trees of custom types correctly - TodoWrapperWrapper", async () => {
    const [br] = bundleResults.filter(
      (br) =>
        br.bundle.parsed.info.title === "Todo API" &&
        br.bundle.parsed.info.version === "1.0.0"
    );
    expect(br).toBeTruthy();
    expect(br).toBeTypeOf("object");
    const { tools } = await mapSpecsToTools({ bundleResults: [br] });
    expect(tools).toBeTruthy();
    expect(tools.length).toEqual(1);
    const [tool] = tools;
    expect(tool).toBeTruthy();
    expect(tool).toBeTypeOf("object");

    const { functionDeclarations: fds } = tool;
    if (!fds) {
      throw new Error("tool.functionDeclarations falsy, asserted as truthy.");
    }
    expect(fds).toBeTruthy();
    expect(Array.isArray(fds)).toBeTruthy();
    expect(fds.length).toBe(7);

    const allFdNames = fds.map((fd) => fd.name);
    expect(allFdNames.length).toEqual(7);
    const ctxFdNames = JSON.stringify({ allFdNames });

    const fd = fds.find((fd) => fd.name === "createTodoWrapperWrapperV1");
    expect(fd, ctxFdNames).toBeTruthy();
    if (!fd) {
      throw new Error("fd falsy, asserted as truthy.");
    }

    const { description: fdDescription, parameters } = fd;
    const ctxFd = JSON.stringify({ fd }, null, 4);

    expect(fdDescription, ctxFd).toBeTruthy();
    expect(fdDescription, ctxFd).toBeTypeOf("string");
    expect(fdDescription, ctxFd).include(
      "Creates a new TodoWrapperWrapper entity in the datastore."
    );
  });
});
