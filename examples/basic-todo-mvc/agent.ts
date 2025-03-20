import fs from "node:fs";
import readline from "node:readline";

import type { AxiosResponse } from "axios";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  type FunctionDeclarationsTool,
  type GenerativeModel,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import {
  bundle,
  loadConfig,
  makeDocumentFromString,
} from "@redocly/openapi-core";

import { Configuration, Todo, TodoApi } from "./openapi-client/index";
import { newRunner } from "../../src/gemini/runner";
import { mapSpecsToTools } from "../../src/index";

async function runChat(opts: {
  readonly prompt: Readonly<string>;
  readonly model: Readonly<GenerativeModel>;
  readonly tools: Array<FunctionDeclarationsTool>;
}): Promise<string> {
  const { model, prompt, tools } = opts;
  if (!model) {
    throw new Error("[runChat] model is required.");
  }
  if (!prompt) {
    throw new Error("[runChat] prompt is required.");
  }
  if (!tools) {
    throw new Error("[runChat] tools is required.");
  }
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools,
    });
    const { candidates } = await result.response;
    if (!Array.isArray(candidates)) {
      throw new Error("Invalid response format candidates not an Array.");
    }
    const [response] = candidates;
    if (!response) {
      throw new Error("[runChat] first Gemini candidate is falsy.");
    }
    const [firstPart] = response.content.parts;
    if (!firstPart) {
      throw new Error("[runChat] first Gemini content part is falsy.");
    }

    if (firstPart.functionCall) {
      console.log("Identified OpenAPI operationId to perform.");
      const ctx = JSON.stringify(firstPart.functionCall);
      const client = new TodoApi(
        new Configuration({ basePath: "http://localhost:3000" })
      );
      const runner = await newRunner<AxiosResponse<Todo>>({
        call: firstPart.functionCall,
        client,
      });
      await runner.run();
      return "Certainly. Issuing the API call: " + ctx;
    } else if (firstPart.text) {
      console.log("Could not identify OpenAPI operationId to perform.");
      return firstPart.text;
    } else {
      throw new Error("Invalid response format. No functionCall nor text.");
    }
  } catch (error) {
    console.error("Error generating content:", error);
    return "An error occurred while generating a response.";
  }
}

async function askQuestion(opts: {
  readonly model: Readonly<GenerativeModel>;
  readonly tools: Array<FunctionDeclarationsTool>;
  readonly readlineIf: Readonly<readline.Interface>;
}): Promise<void> {
  const { model, tools, readlineIf } = opts;
  if (!readlineIf) {
    throw new Error("[askQuestion] readlineIf is required.");
  }
  if (!model) {
    throw new Error("[askQuestion] model is required.");
  }
  if (!tools) {
    throw new Error("[askQuestion] tools is required.");
  }

  readlineIf.question("You: ", async (prompt: string) => {
    if (prompt.toLowerCase() === "quit" || prompt.toLowerCase() === "q") {
      console.log("Bot: Goodbye!");
      readlineIf.close();
      process.exit(0);
    } else {
      const response = await runChat({ prompt, model, tools });
      console.log("Bot:", response);
      askQuestion(opts);
    }
  });
}

async function main() {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("Please set the GEMINI_API_KEY environment variable.");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const argv = await yargs(hideBin(process.argv))
    .option("prompt", {
      alias: "p",
      type: "string",
      description: "The prompt to send to the chatbot.",
    })
    .option("open-api-specs", {
      alias: "s",
      type: "array",
      string: true,
      description:
        "The list of OpenAPI specification file to use. This parameter expects a valid file-system path. JSON and YAML formats are supported.",
    })
    .help()
    .alias("help", "h")
    .parse();

  const specs: Array<string> = [];
  if (argv.openApiSpecs) {
    for (const spec of argv.openApiSpecs) {
      const exists = await fs.existsSync(spec);
      if (!exists) {
        console.warn("Skipping %s because it does not exist.", spec);
        continue;
      }
      const specStr = await fs.readFileSync(spec, "utf8");
      specs.push(specStr);
    }
  }
  const bundleResultsPromises = specs.map(async (specStr) => {
    const config = await loadConfig({});
    const doc = makeDocumentFromString(specStr, "/");

    return bundle({
      doc,
      config,
      dereference: true,
    });
  });
  const bundleResults = await Promise.all(bundleResultsPromises);
  const { tools } = await mapSpecsToTools({ bundleResults });

  if (argv.prompt) {
    const { prompt } = argv;

    const response = await runChat({ prompt, model, tools });
    console.log("Bot:", response);
    process.exit(0);
  }

  const readlineIf = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  askQuestion({ model, tools, readlineIf });
}

main();
