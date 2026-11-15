export const log = {
  info: (msgOrObj: unknown, msg?: string) => {
    if (typeof msgOrObj === "string") {
      console.log(`[${new Date().toISOString()}] INFO: ${msgOrObj}`);
    } else {
      console.log(`[${new Date().toISOString()}] INFO: ${msg || ""} ${JSON.stringify(msgOrObj)}`);
    }
  },
  warn: (msgOrObj: unknown, msg?: string) => {
    if (typeof msgOrObj === "string") {
      console.warn(`[${new Date().toISOString()}] WARN: ${msgOrObj}`);
    } else {
      console.warn(`[${new Date().toISOString()}] WARN: ${msg || ""} ${JSON.stringify(msgOrObj)}`);
    }
  },
  error: (msgOrObj: unknown, msg?: string) => {
    if (typeof msgOrObj === "string") {
      console.error(`[${new Date().toISOString()}] ERROR: ${msgOrObj}`);
    } else {
      console.error(`[${new Date().toISOString()}] ERROR: ${msg || ""} ${JSON.stringify(msgOrObj)}`);
    }
  }
};
