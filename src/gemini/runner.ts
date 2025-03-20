import type { FunctionCall } from "@google/generative-ai";

export type Runner<T> = { run(): Promise<T> };

export async function newRunner<T>(opts: {
  readonly client: any;
  readonly call: Readonly<FunctionCall>;
}): Promise<Runner<T>> {
  const runner: Runner<T> = {
    run: async (): Promise<T> => {
      const fn = opts.client[opts.call.name];
      const boundFn = fn.bind(opts.client);
      return boundFn(opts.call.args);
    },
  };
  return runner;
}
