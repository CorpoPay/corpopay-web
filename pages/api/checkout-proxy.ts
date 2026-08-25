import type { NextApiRequest, NextApiResponse } from "next";
import { getErrorMessage, serverClient } from "@/lib/client";

/**
 * Proxy for the hosted checkout pay action.
 * Forwards POST /public/checkout/{slug}/pay from the browser to the backend
 * so the API URL is never exposed client-side and CORS is avoided.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { slug, customerEmail, customerName, installmentPlanId, downPaymentAmount } = req.body as {
    slug: string;
    customerEmail?: string;
    customerName?: string;
    installmentPlanId?: string;
    downPaymentAmount?: number;
  };

  if (!slug) {
    return res.status(400).json({ message: "Missing slug" });
  }

  try {
    const { data, error, response } = await serverClient.POST("/public/checkout/{slug}/pay", {
      params: { path: { slug } },
      body: {
        customerEmail: customerEmail || undefined,
        customerName: customerName || undefined,
        installmentPlanId,
        downPaymentAmount,
      },
    });

    if (error || !data) {
      return res.status(response.status).json({ message: getErrorMessage(error) });
    }

    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ message: "Upstream error" });
  }
}
