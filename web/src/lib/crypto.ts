import { createHash, randomInt } from "crypto";

export function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function randomSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
