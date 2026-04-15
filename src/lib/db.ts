import { PrismaClient } from "@prisma/client";

// Serialize BigInt as a plain JS number in JSON responses. Our only BigInt
// column is `totalTokens`, which fits comfortably in Number.MAX_SAFE_INTEGER
// (2^53 ≈ 9e15 vs harness totals in the low billions). Patching here — at
// the Prisma import boundary — ensures any route that serializes a Prisma
// row via NextResponse.json() works without per-site conversion.
interface BigIntWithToJSON {
  toJSON(): number;
}
if (
  typeof (BigInt.prototype as unknown as BigIntWithToJSON).toJSON !== "function"
) {
  (BigInt.prototype as unknown as BigIntWithToJSON).toJSON = function () {
    return Number(this);
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
