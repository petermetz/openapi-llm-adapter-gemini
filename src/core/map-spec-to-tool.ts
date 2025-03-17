import type {
  FunctionDeclaration,
  FunctionDeclarationSchema,
  FunctionDeclarationsTool,
  FunctionDeclarationSchemaProperty,
  ObjectSchema,
  Schema,
} from "@google/generative-ai";
import { type BundleResult } from "@redocly/openapi-core/lib/bundle";
import type { OpenAPIV3, OpenAPIV3_1 } from "@scalar/openapi-types";
import { guessOperationId } from "../openapi/guess-operation-id";

export type { Runner } from "../gemini/runner";

export const E_REF_NOT_SUP =
  `Reference objects are not supported by the library. Have you forgotten ` +
  `to bundle and dereference it your specification as shown in the usage examples?`;

export const W_OA_PAR_NON = "WARNING_OPEN_API_PARAMETER_HAD_NO_NAME";

export function isV3ReferenceObject(
  x: unknown
): x is OpenAPIV3.ReferenceObject {
  return typeof x === "object" && x !== null && "$ref" in x;
}

export function isV3_1RequestBodyObject(
  x: unknown
): x is OpenAPIV3_1.RequestBodyObject {
  return typeof x === "object" && x !== null;
}

export function isV3RequestBodyObject(
  x: unknown
): x is OpenAPIV3.RequestBodyObject {
  return typeof x === "object" && x !== null && "content" in x;
}

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
 *
 * We define our own version of the OpenAPI data types here so that we don't
 * have to import the `"@google/generative-ai"` library as a runtime dependency
 * just for using the SchemaType constants that they have defined in
 * there which are just mimicking the OpenAPI data types anyway.
 *
 * The relevant types from the OpenAPI Typescript types:
 * ```typescript
 * type NonArraySchemaObjectType = 'boolean' | 'object' | 'number' | 'string' | 'integer';
 * type ArraySchemaObjectType = 'array';
 * ```
 *
 * @see https://swagger.io/docs/specification/v3_0/data-models/data-types/
 */
enum SchemaType {
  STRING = "string",
  NUMBER = "number",
  INTEGER = "integer",
  BOOLEAN = "boolean",
  ARRAY = "array",
  OBJECT = "object",
}

export const OperationTypeNames = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

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

function isHttpMethodOperationPair(
  entry: [string, any]
): entry is [OpenAPIV3.HttpMethods, OpenAPIV3.OperationObject] {
  if (!entry || !Array.isArray(entry) || entry.length < 2) {
    return false;
  }
  const [method, operation] = entry;
  return (
    OperationTypeNames.includes(method) &&
    typeof operation === "object" &&
    operation !== null
  );
}

function mapParameterObjectToSchema(
  p: OpenAPIV3.ParameterObject
): FunctionDeclarationSchemaProperty {
  const { schema, type } = p;
  const out: Schema = {
    name: p.name,
    type: p.type || p.schema.type,
    description: p.description || p.name,
    required: p.required,
  };
  return out;
}

function mergeOpenApiV3Parameters(params: OpenAPIV3.ParameterObject[]): {
  [k: string]: OpenAPIV3.ParameterObject;
} {
  const fn = "mergeOpenApiV3Parameters()";
  return Object.fromEntries(
    params.map((parameter) => {
      try {
        const { schema, type, name, description, required } = parameter;
        return [
          parameter.name,
          {
            name: name,
            type: type || schema?.type,
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

function isParameterObject(
  obj: OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject
): obj is OpenAPIV3.ParameterObject {
  return !("$ref" in obj); // Assuming ReferenceObject has a "$ref" property
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
    isHttpMethodOperationPair
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
      ? pathItem.parameters.filter(isParameterObject)
      : [];

    const operationParams = operation.parameters
      ? operation.parameters.filter(isParameterObject) 
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
