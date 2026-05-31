"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import webpush from "web-push";

// Send a Web Push notification to every device the user has subscribed. Runs in
// the Node runtime (web-push needs node crypto). Fails safe: if VAPID isn't
// configured the whole feature is a no-op. Dead endpoints (404/410) are pruned.
export const notifyReminder = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return; // push not configured — no-op

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:notifications@whatsai.app",
      publicKey,
      privateKey,
    );

    const subs = await ctx.runQuery(internal.pushSubscriptions.getSubscriptionsForUser, {
      userId: args.userId,
    });
    if (subs.length === 0) return;

    const payload = JSON.stringify({ title: args.title, body: args.body, url: args.url });

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
        } catch (err: any) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) {
            // Subscription expired/unsubscribed — drop it.
            await ctx.runMutation(internal.pushSubscriptions._deleteByEndpoint, {
              endpoint: s.endpoint,
            });
          } else {
            console.error("Web push send failed:", code, err?.body ?? err?.message);
          }
        }
      }),
    );
  },
});
