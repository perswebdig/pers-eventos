import { NextResponse } from "next/server";

// Health check para PM2 / Docker / nginx e plataformas serverless.
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "pers-eventos",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
