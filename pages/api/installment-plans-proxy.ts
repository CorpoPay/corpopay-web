import type { NextApiRequest, NextApiResponse } from "next";
import { getErrorMessage, serverClient } from "@/lib/client";

/**
 * Proxy for the public installment plans endpoint.
 * GET /api/installment-plans-proxy?slug=<paymentLinkSlug>
 *
 * Forwards to: GET /public/installment-plans/:slug on the backend.
 * Returns available BNPL plans with per-plan amortization preview.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { slug } = req.query;
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ message: "Missing slug" });
  }

  try {
    const { data, error, response } = await serverClient.GET("/public/installment-plans/{slug}", {
      params: { path: { slug } },
    });

    if (error || !data) {
      return res.status(response.status).json({ message: getErrorMessage(error) });
    }

    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ message: "Failed to load installment plans" });
  }
}
