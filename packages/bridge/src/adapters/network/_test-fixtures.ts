import type { NetworkAgentHelloAuthorization } from "./socket-relay.ts";

export function allowInsecureNetworkAgentHelloForTests(): NetworkAgentHelloAuthorization {
  return { ok: true };
}
