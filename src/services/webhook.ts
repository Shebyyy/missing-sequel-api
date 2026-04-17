export interface WebhookPayload {
  tracking_id: string;
  platform: string;
  user_id: number;
  timestamp: string;
  media: any;
  user_list_status: any;
  user_status: string;
  total_items: number;
  remaining: number;
}

export async function sendWebhook(url: string, payload: WebhookPayload): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    return { success: res.ok, status: res.status };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Webhook delivery failed',
    };
  }
}
