import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    return NextResponse.json({ status: "ok", db: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 },
    );
  }
}
