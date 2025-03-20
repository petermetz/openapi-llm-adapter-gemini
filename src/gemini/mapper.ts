import type {
  FunctionDeclaration,
  FunctionDeclarationSchema,
  FunctionDeclarationsTool,
  FunctionDeclarationSchemaProperty,
  Schema,
} from "@google/generative-ai";
import type { BundleResult } from "@redocly/openapi-core/lib/bundle";
import type { OpenAPIV3 } from "@scalar/openapi-types";

import { guessOperationId } from "../openapi/guess-operation-id";
import { isV3ReferenceObject } from "../openapi/is-v3-reference-object";
import { isV3ParameterObject } from "../openapi/is-v3-parameter-object";
import { isV3RequestBodyObject } from "../openapi/is-v3-request-body-object";
import { isV3HttpMethodOperationPair } from "../openapi/is-v3-http-method-operation-pair";
import { SchemaType } from "./mapper/schema-type";

export const E_REF_NOT_SUP =
  `Reference objects are not supported by the library. Have you forgotten ` +
  `to bundle and dereference it your specification as shown in the usage examples?`;

export const W_OA_PAR_NON = "WARNING_OPEN_API_PARAMETER_HAD_NO_NAME";

export interface IOpenApiContext {
  /**
   * The top level info object's title property from the OpenAPI specification.
   */
  readonly title: Readonly<string>;

  /**
   * The bundled OpenAPI spec.
   * The recommended way to create this object via redocly's tooling:
   * ```typescript
   * import { bundle, BundleResult } from "@redocly/openapi-core/lib/bundle";
   * import { loadConfig, makeDocumentFromString } from "@redocly/openapi-core";
   * // read in as many OpenAPI specification files as you want,
   * // then store their contents in an array for further processing
   * const specBuffers = [
   *   Buffer.from(
   *     `{"openapi":"3.0.3","info":{"title":"Todo API","version": "1.0.0","description":"A simple Todo API"}}`,
   *     "utf-8"
   *   ),
   * ];
   *
   * const docs = specBuffers.map(
   *   (data) => makeDocumentFromString(data.toString("utf-8"), "/"),
   *   "/"
   * );
   *
   * const config = await loadConfig({});
   * const dereference = true;
   * const bundleResults: Array<Readonly<BundleResult>> = [];
   *
   * await Promise.all(
   *   docs.map(async (doc) =>
   *     bundle({ doc, config, dereference }).then((br) => bundleResults.push(br))
   *   )
   * );
   *
   * ```
   */
  readonly bundleResult: Readonly<BundleResult>;
}

export interface IOpenApiSpecToGeminiToolsResponse {
  readonly tools: Array<FunctionDeclarationsTool>;

  /**
   * Mapping between the Gemini tool and their respective bundle pertaining to the
   * OpenAPI spec they were built from.
   */
  readonly map: Map<FunctionDeclarationsTool, Readonly<IOpenApiContext>>;
}

/**
 * Transforms an OpenAPI spec into the format expected by Gemini's function calls which are also
 * referred to as `tools`.
 *
 * @see https://ai.google.dev/gemini-api/docs/function-calling/tutorial?lang=node
 */
export async function mapSpecsToTools(opts: {
  readonly bundleResults: ReadonlyArray<Readonly<BundleResult>>;
}): Promise<IOpenApiSpecToGeminiToolsResponse> {
  const fn = "mapSpecsToTools()";
  const out: IOpenApiSpecToGeminiToolsResponse = { tools: [], map: new Map() };

  for (const br of opts.bundleResults) {
    const { title, version } = br.bundle.parsed.info;
    const paths = br.bundle.parsed.paths;

    if (!paths) {
      const ctxJson = JSON.stringify({ title, version });
      console.warn("%s OpenAPI spec without paths, Skipping. %s", fn, ctxJson);
      continue;
    }
    const { tool } = mapPathObjectToTool({ paths, title, version, br });
    out.map.set(tool, { bundleResult: br, title });
    out.tools.push(tool);
  }

  return out;
}

function mergeOpenApiV3Parameters(params: OpenAPIV3.ParameterObject[]): {
  [k: string]: OpenAPIV3.ParameterObject;
} {
  const fn = "mergeOpenApiV3Parameters()";
  return Object.fromEntries(
    params.map((parameter) => {
      try {
        const { schema, name, description, required } = parameter;
        return [
          parameter.name,
          {
            name: name,
            type: schema?.type,
            description: description || name,
            required: required,
          },
        ];
      } catch (cause: unknown) {
        const ctx = JSON.stringify({ parameter });
        throw new Error(`[${fn}] crashed. ctx: ${ctx}`, { cause });
      }
    })
  );
}

function mapPathItemToFunctionDeclarations(opts: {
  readonly title: Readonly<string>;
  readonly version: Readonly<string>;
  readonly pathItemKey: Readonly<string>;
  readonly pathItem: Readonly<OpenAPIV3.PathItemObject>;
  readonly br: Readonly<BundleResult>;
}): {
  readonly functionDeclarations: ReadonlyArray<Readonly<FunctionDeclaration>>;
} {
  const fn = "mapPathItemToFunctionDeclarations()";
  const { pathItem, pathItemKey } = opts;

  const methodEntries = Object.entries(pathItem).filter(
    isV3HttpMethodOperationPair
  );

  const functionDeclarations: FunctionDeclaration[] = [];

  for (const [method, operation] of methodEntries) {
    // If there is no operation ID, we have to generate it like the OpenAPI
    // generator would. Look for a template variable called `nickname` if you
    // are diving into how that's done in the source code of the generator itself.
    if (!operation.operationId) {
      const { operationId } = guessOperationId({ path: pathItemKey, method });
      operation.operationId = operationId;
    }

    const pathItemParams = pathItem.parameters
      ? pathItem.parameters.filter(isV3ParameterObject)
      : [];

    const operationParams = operation.parameters
      ? operation.parameters.filter(isV3ParameterObject)
      : [];

    /**
     * PathItem level parameters can be overridden by the Operation level ones
     * as per the specification:
     * @see https://swagger.io/specification/#path-item-object
     */
    const openApiParameters: { [k: string]: OpenAPIV3.ParameterObject } = {
      ...mergeOpenApiV3Parameters(pathItemParams),
      ...mergeOpenApiV3Parameters(operationParams),
    };

    const {
      requestBody,
      operationId,
      summary: opSummary,
      description: opDescription,
    } = operation;

    if (isV3ReferenceObject(requestBody)) {
      // We throw here because the caller must've forgotten to bundle and dereference
      // so instead of logging warnings (which might get ignored) we give out a stronger
      // signal that something is definitely wrong with the input.
      throw new Error(E_REF_NOT_SUP);
    }

    if (!isV3RequestBodyObject(requestBody)) {
      const functionDeclaration: FunctionDeclaration = {
        name: operationId,
        description:
          opSummary ||
          opDescription ||
          "This operation does not have a description.",
      };
      if (openApiParameters && Object.keys(openApiParameters).length > 0) {
        const required = Object.values(openApiParameters)
          .filter((p) => p.required === true)
          .map((p) => p.name || W_OA_PAR_NON);

        functionDeclaration.parameters = {
          type: SchemaType.OBJECT,
          description: opSummary + " " + opDescription,
          // FIXME(petermetz): eliminate the need for casting here
          properties: openApiParameters as { [k: string]: Schema },
          required,
        };
      }

      functionDeclarations.push(functionDeclaration);
      continue;
    }

    const { description: rbDescription, content } = requestBody;
    if (!content) {
      console.log("requestBody.content falsy, falling back");
      const required = openApiParameters
        ? Object.values(openApiParameters)
            .filter((p) => p.required === true)
            .map((p) => p.name)
        : [];

      const parameters: FunctionDeclarationSchema = {
        type: SchemaType.OBJECT,
        properties: openApiParameters as any, // FIXME(petermetz)
        required,
        description:
          rbDescription ||
          opSummary ||
          opDescription ||
          "No summary nor description.",
      };

      const functionDeclaration: FunctionDeclaration = {
        name: operationId,
        description:
          opSummary || rbDescription || "No summary nor description.",
        parameters,
      };
      functionDeclarations.push(functionDeclaration);
      continue;
    }
    const contentTypeKeys = Object.keys(content);
    if (contentTypeKeys.length === 0) {
      console.warn("requestBody.content has no content types, skipping.");
      continue;
    }

    const [firstContentTypeKey] = contentTypeKeys;

    const firstContentType = content[firstContentTypeKey];
    if (!firstContentType) {
      console.warn("requestBody.content[0] is falsy. Skipping");
      continue;
    }

    const { schema } = firstContentType;
    if (!schema) {
      console.warn("requestBody.content has no schema. Skipping");
      continue;
    }

    const required1 = openApiParameters
      ? Object.values(openApiParameters)
          .filter((p) => p.required === true)
          .map((p) => p.name)
      : [];

    if (isV3ReferenceObject(schema)) {
      throw new Error(`${fn} ${E_REF_NOT_SUP}`);
    }

    const required2 = schema.properties
      ? Object.values(schema.properties)
          .filter((p) => p.required)
          .map((p) => p.name)
      : [];

    const required = [...required1, ...required2];

    const parametersType = schema.type || SchemaType.OBJECT;
    if (!schema.type) {
      console.warn(`${fn} schema.type falsy, defaulting ${SchemaType.OBJECT}`);
    }
    const parameters: FunctionDeclarationSchema = {
      type: parametersType as SchemaType, // FIXME(petermetz) eliminate the need for this cast
      description:
        rbDescription ||
        opSummary ||
        opDescription ||
        "No summary nor description.",
      properties: {
        ...openApiParameters,
        ...schema.properties,
      } as {
        [k: string]: FunctionDeclarationSchemaProperty;
      }, // FIXME(petermetz): eliminate the need for this cast
      required,
    };

    const functionDeclaration: FunctionDeclaration = {
      name: operationId,
      description:
        opSummary ||
        rbDescription ||
        opDescription ||
        "No summary nor description.",
      parameters,
    };

    functionDeclarations.push(functionDeclaration);
  }

  return Object.freeze({ functionDeclarations });
}

function mapPathObjectToTool(opts: {
  readonly title: Readonly<string>;
  readonly version: Readonly<string>;
  readonly paths: Record<string, OpenAPIV3.PathItemObject>;
  readonly br: Readonly<BundleResult>;
}): {
  readonly tool: Readonly<FunctionDeclarationsTool>;
} {
  const fn = "mapPathObjectToTool()";

  const { paths, title, version } = opts;
  const allFds: FunctionDeclaration[] = [];
  const tool: FunctionDeclarationsTool = { functionDeclarations: allFds };

  const pathEntries = Object.entries(paths);

  for (const [pathItemKey, pathItem] of pathEntries) {
    const ctxJson = JSON.stringify({ title, version, pathItemKey });
    if (!pathItem) {
      console.warn("%s falsy pathItem found, skipping. %s", fn, ctxJson);
      continue;
    }
    if (typeof pathItem !== "object") {
      console.warn("%s non-object pathItem found, skipping. %s", fn, ctxJson);
      continue;
    }

    const { functionDeclarations } = mapPathItemToFunctionDeclarations({
      title,
      version,
      pathItemKey,
      pathItem,
      br: opts.br,
    });

    allFds.push(...functionDeclarations);
  }

  return { tool };
}
