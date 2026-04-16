import { PrismaClient } from "@prisma/client";

// Serialize BigInt as a plain JS number in JSON responses. Our only BigInt
// column today is `totalTokens` (low billions, well under Number.MAX_SAFE_INTEGER
// ≈ 9e15). Patching here — at the Prisma import boundary — keeps every route
// that serializes a Prisma row via NextResponse.json() working without per-site
// conversion.
//
// Safety guard: if a future code path produces a BigInt larger than what JS
// Number can represent without precision loss, we throw rather than silently
// truncating. Better to surface the bug in a server log + 500 than to ship
// incorrect numbers to clients. If/when that happens, switch the offending
// surface to explicit DTO serialization (e.g. as a decimal string).
interface BigIntWithToJSON {
  toJSON(): number;
}
if (
  typeof (BigInt.prototype as unknown as BigIntWithToJSON).toJSON !== "function"
) {
  (BigInt.prototype as unknown as BigIntWithToJSON).toJSON = function () {
    const value = this as unknown as bigint;
    if (
      value > BigInt(Number.MAX_SAFE_INTEGER) ||
      value < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new Error(
        `BigInt ${value.toString()} exceeds Number.MAX_SAFE_INTEGER; ` +
          `use explicit DTO serialization (e.g. .toString()) for this field.`,
      );
    }
    return Number(value);
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
