import { snakeToCamel } from "../common/snake-to-camel";

export interface IGuessOperationIdOptions {
  readonly path: Readonly<string>;
  readonly method: Readonly<string>;
}

export interface IGuessOperationIdOutput {
  readonly operationId: Readonly<string>;
}

function verifyOptions(
  opts: Readonly<IGuessOperationIdOptions>
): asserts opts is IGuessOperationIdOptions {
  if (!opts) {
    throw new Error("[guessOperationId] opts is required but was falsy.");
  }

  const { path, method } = opts;
  if (!path) {
    throw new Error("[guessOperationId] opts.path is required but was falsy.");
  }
  if (typeof path !== "string") {
    throw new Error("[guessOperationId] opts.path must be a string.");
  }
  if (!method) {
    throw new Error("[guessOperationId] opts.method cannot be falsy.");
  }
  if (typeof method !== "string") {
    throw new Error("[guessOperationId] opts.method must be a string.");
  }
}

/**
 * Guesses the computed operation ID produce by OpenAPI generator for a path+method pair
 * when the specification author did not provide an explicit `operationId` value in their
 * specification document.
 * This is necessary because on the Gemini side the name of the operation is mandatory, but in
 * the OpenAPI specification it is optional to provide the `operationId` property.
 *
 * @see https://swagger.io/specification/#operation-object
 * @see https://swagger.io/specification/#path-item-object
 * @see https://ai.google.dev/gemini-api/docs/function-calling#function_declarations
 *
 * @param opts
 * @returns
 */
export function guessOperationId(
  opts: Readonly<IGuessOperationIdOptions>
): Readonly<IGuessOperationIdOutput> {
  verifyOptions(opts);

  const { method, path } = opts;

  const idParts = path
    .split("/")
    .map((p) => p.replace(/[\W_]+/g, " ").trim())
    .filter((p) => p.length > 0);

  idParts.push(method);

  const snakeCase = idParts.join("_");
  const operationId = snakeToCamel(snakeCase);
  return { operationId };
}
