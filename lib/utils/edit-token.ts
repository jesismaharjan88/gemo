import { randomBytes } from "crypto";

export function generateEditToken(): string {
  return randomBytes(8).toString("hex"); // 16 hex chars, cryptographically random
}
