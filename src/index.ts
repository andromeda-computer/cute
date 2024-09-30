import { Hono } from "hono";
import { Buffer } from "buffer";
// import { newDenoHTTPWorker } from "./DenoHTTPWorker.ts";
import { newDenoHTTPWorker } from "deno-http-worker";
import { Data } from "hono/dist/types/context";
import { StatusCode } from "hono/utils/http-status";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

interface WorkerResponse {
  headers: { [key: string]: string };
  status?: StatusCode;
  body: string;
}

app.post("/execute", async (c) => {
  // TODO it would be good to parse the body to handle things like
  // cron jobs, scripts, or http handlers differently.
  const code = await c.req.text();

  let worker = await newDenoHTTPWorker(code, {
    printOutput: true,
    runFlags: ["--allow-net"],
  });

  worker.stdout.on("data", (data: Data) => {
    console.log("cj", data.toString());
  });

  const resp: WorkerResponse = await new Promise((resolve, reject) => {
    const req = worker.request(
      "https://hello/world?query=param",
      {},
      (resp) => {
        const body: any[] = [];
        resp.on("error", reject);
        resp.on("data", (chunk: any) => {
          body.push(chunk);
        });
        resp.on("end", () => {
          resolve({
            headers: resp.headers,
            status: resp.status,
            body: Buffer.concat(body).toString(),
          });
        });
      }
    );
    req.end();
  });
  worker.terminate();

  return c.body(resp.body, resp.status ? resp.status : 200, resp.headers);
});

export default {
  port: 4242,
  fetch: app.fetch,
};
