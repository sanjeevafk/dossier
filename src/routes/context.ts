import type { IncomingMessage, ServerResponse } from "node:http";

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  pathname: string;
  parsedUrl: URL;
}
