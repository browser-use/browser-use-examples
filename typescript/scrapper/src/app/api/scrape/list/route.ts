import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const entries = await db.query.profiles.findMany();

  return NextResponse.json(entries);
}
