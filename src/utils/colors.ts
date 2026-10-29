import { styleText } from "node:util";

export const pc = {
  green: (s: unknown) => styleText("green", String(s)),
  red: (s: unknown) => styleText("red", String(s)),
  yellow: (s: unknown) => styleText("yellow", String(s)),
  blue: (s: unknown) => styleText("blue", String(s)),
  magenta: (s: unknown) => styleText("magenta", String(s)),
  cyan: (s: unknown) => styleText("cyan", String(s)),
  white: (s: unknown) => styleText("white", String(s)),
  gray: (s: unknown) => styleText("gray", String(s)),
  bold: (s: unknown) => styleText("bold", String(s)),
  dim: (s: unknown) => styleText("dim", String(s)),
  italic: (s: unknown) => styleText("italic", String(s)),
  underline: (s: unknown) => styleText("underline", String(s)),
  reset: (s: unknown) => styleText("reset", String(s))
};

export default pc;
