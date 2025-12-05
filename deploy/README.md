Deployment options for whatsai

Option A — Cloudflare Pages (recommended)
- Outcome: Fully static hosting with global CDN, no server to keep running. Integrates with GitHub for automatic deploys on push. Easiest way to make it consistent and permanent.

Steps
1) In Cloudflare Dashboard → Pages → Create project → Connect to GitHub
   - Select repository: yishaik/whatsai
   - Framework preset: None
   - Build command: npm ci && npm run build
   - Build output directory: dist
   - Environment variables (optional):
     - NODE_VERSION=20
2) After first deploy, add a custom domain:
   - Custom domain: whatsai.yishaik.com
   - Cloudflare will create/verify the CNAME and configure TLS
3) Done. Every push to master triggers a new deploy.

Notes
- The app is static. All OpenRouter calls are made client-side by the user’s browser.
- You can keep the same “Settings → API Key” behavior; no server secrets are required.

Option B — Self-hosted static preview behind Cloudflare Tunnel
- Outcome: Your device serves the built app locally; Cloudflare Tunnel exposes it on whatsai.yishaik.com. Use systemd to keep it running.

1) Build once
   npm ci
   npm run build

2) Run static preview as a service (port 8080)
   - Copy deploy/systemd/whatsai-preview.service to /etc/systemd/system/whatsai-preview.service
   - Edit WorkingDirectory and User to match your environment
   - sudo systemctl daemon-reload
   - sudo systemctl enable --now whatsai-preview

3) Cloudflared service for this tunnel
   - Create a tunnel (one-time): cloudflared tunnel login; cloudflared tunnel create whatsai
   - Copy ~/.cloudflared/<TUNNEL_ID>.json path
   - Copy deploy/cloudflared/whatsai.yml.example to /etc/cloudflared/whatsai.yml and fill TUNNEL_ID and credentials-file path
   - Route DNS: cloudflared tunnel route dns whatsai whatsai.yishaik.com (add --overwrite-dns to replace existing)
   - Copy deploy/systemd/cloudflared-whatsai.service to /etc/systemd/system/cloudflared-whatsai.service
   - sudo systemctl daemon-reload
   - sudo systemctl enable --now cloudflared-whatsai

4) Verify
   - curl -I https://whatsai.yishaik.com
   - You should see 200/304 from the Vite preview static server

Option C — GitHub Pages
- Use GitHub Actions to deploy /dist to GitHub Pages, then set CNAME “whatsai.yishaik.com” in repo settings and Cloudflare DNS to point to <your-username>.github.io. Cloudflare Pages is typically simpler if your domain is on Cloudflare.

