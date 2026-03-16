/**
 * Localhost callback server for OAuth PKCE redirect capture.
 *
 * Starts a temporary HTTP server on localhost to receive the
 * authorization code from the OAuth redirect. Shuts down
 * after receiving the code or on timeout.
 *
 * @module lib/server/client-auth/callback-server
 */

export interface CallbackServerOptions {
  /** Port to listen on (0 = auto-assign, default: 0) */
  port?: number;
  /** Timeout in ms (default: 120_000) */
  timeout?: number;
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><title>PML Auth</title><style>
body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#08080a;color:#fff}
.card{text-align:center;padding:2rem}h1{color:#FFB86F}
</style></head><body><div class="card">
<h1>Authentication successful</h1>
<p>You can close this tab and return to the terminal.</p>
</div></body></html>`;

const ERROR_HTML = `<!DOCTYPE html>
<html><head><title>PML Auth Error</title><style>
body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#08080a;color:#fff}
.card{text-align:center;padding:2rem}h1{color:#ff6b6b}
</style></head><body><div class="card">
<h1>Authentication failed</h1>
<p>Missing authorization code. Please try again.</p>
</div></body></html>`;

export class CallbackServer {
  private port: number;
  private timeout: number;
  private abortController: AbortController | null = null;
  private server: Deno.HttpServer | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private closeTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: CallbackServerOptions) {
    this.port = options?.port ?? 0;
    this.timeout = options?.timeout ?? 120_000;
  }

  async start(): Promise<{ port: number; codePromise: Promise<string> }> {
    this.abortController = new AbortController();

    let resolveCode!: (code: string) => void;
    let rejectCode!: (err: Error) => void;
    const codePromise = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });

    this.timerId = setTimeout(() => {
      this.timerId = null;
      rejectCode(
        new Error(
          "OAuth callback timeout — no authorization code received",
        ),
      );
      this.close();
    }, this.timeout);

    this.server = Deno.serve(
      {
        port: this.port,
        signal: this.abortController.signal,
        onListen: () => {},
      },
      (req) => {
        const url = new URL(req.url);
        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          if (!code) {
            return new Response(ERROR_HTML, {
              status: 400,
              headers: { "Content-Type": "text/html" },
            });
          }
          if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
          }
          resolveCode(code);
          // Schedule close after response is sent
          this.closeTimerId = setTimeout(() => {
            this.closeTimerId = null;
            this.close();
          }, 100);
          return new Response(SUCCESS_HTML, {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    );

    const addr = this.server.addr as Deno.NetAddr;
    return { port: addr.port, codePromise };
  }

  async close(): Promise<void> {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.closeTimerId) {
      clearTimeout(this.closeTimerId);
      this.closeTimerId = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.server) {
      try {
        await this.server.finished;
      } catch {
        // Expected when aborted
      }
      this.server = null;
    }
  }
}
