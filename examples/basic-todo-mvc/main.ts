// main.ts
import "@angular/compiler";
import "@angular/platform-server";
import "zone.js";

import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import { renderApplication } from "@angular/platform-server";
import { withFetch, provideHttpClient } from "@angular/common/http";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideAnimations } from "@angular/platform-browser/animations";

import { Todo, AppComponent } from "./app.component";

const fastify = Fastify({
  logger: true,
});

let serverSideTodos: Todo[] = [
  { id: 1, title: "Learn Angular SSR" },
  { id: 2, title: "Build a demo app" },
];

let nextId = 3;

fastify.get("/todos", async (request, reply) => {
  reply.send(serverSideTodos);
});

fastify.post(
  "/todos",
  async (
    request: FastifyRequest<{ Body: { title: string } }>,
    reply: FastifyReply
  ) => {
    const { title } = request.body;
    const newTodo = { id: nextId++, title };
    serverSideTodos.push(newTodo);
    reply.code(201).send(newTodo);
  }
);

fastify.get("/*", async (request, reply) => {
  const indexHtml = await renderApplication(
    () =>
      bootstrapApplication(AppComponent, {
        providers: [provideHttpClient(withFetch()), provideAnimations()],
      }),
    {
      document: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>&#64;petermetz-fyi/openapi-llm-adapter-gemini</title>
          <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
          <link href="https://unpkg.com/@angular/material@16.2.0/prebuilt-themes/indigo-pink.css" rel="stylesheet">
          <style>
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
            }
            mat-toolbar {
              width: 100%;
            }
          </style>
        </head>
        <body>
          <app-root></app-root>
        </body>
        </html>
      `,
      url: request.url,
    }
  );

  reply.header("Content-Type", "text/html").send(indexHtml);
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log("Server listening on port 3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
