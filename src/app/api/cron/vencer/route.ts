import { timingSafeEqual } from "node:crypto";
import { getUseCases } from "@/infrastructure/container";

// Libera las citas que nadie confirmó a tiempo. Lo llama un programador cada 5 minutos (Vercel Cron, Railway,
// cron-job.org…) con la cabecera `Authorization: Bearer <CRON_SECRET>`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const report = await getUseCases().bookingConfirmation.expireOverdue();
  if (report.failed > 0) console.error("vencer citas: avisos que no salieron", report);
  return Response.json(report);
}

function sameSecret(received: string | null, expected: string): boolean {
  const a = Buffer.from(received ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
