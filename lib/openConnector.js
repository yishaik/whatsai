// Server-only Open Connector client. Used by api/persona-response.ts.
// Dedicated runtime token — never the admin token.

const DEFAULT_URL = 'https://connect.yishaik.com';

const ALIAS = {
  youtube: 'default',
  mx_toolbox: 'MxToolbox-theyishaik',
  telegram: 'ops',
};

const MX_CHECKS = {
  mx: 'mx_toolbox.lookup_mx',
  spf: 'mx_toolbox.lookup_spf',
  dmarc: 'mx_toolbox.lookup_dmarc',
  dns: 'mx_toolbox.lookup_dns',
  dkim: 'mx_toolbox.lookup_dkim',
  blacklist: 'mx_toolbox.lookup_blacklist',
  'mta-sts': 'mx_toolbox.lookup_mta_sts_record',
  bimi: 'mx_toolbox.lookup_bimi_record',
  http: 'mx_toolbox.lookup_http',
  ping: 'mx_toolbox.lookup_ping',
};

export const OPEN_CONNECTOR_TOOL_NAMES = ['youtube_stats', 'mx_lookup', 'telegram_notify'];

export const isOpenConnectorConfigured = () =>
  Boolean(String(process.env.OPEN_CONNECTOR_TOKEN || '').trim());

const ocUrl = () => String(process.env.OPEN_CONNECTOR_URL || DEFAULT_URL).replace(/\/+$/, '');

const ocToken = () => String(process.env.OPEN_CONNECTOR_TOKEN || '').trim();

const clip = (value, max = 240) => {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

const compactItems = (items, max = 8) => {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max).map((item) => {
    if (!item || typeof item !== 'object') return String(item);
    return {
      name: item.Name || item.name,
      info: clip(item.Info || item.info, 160),
    };
  });
};

export async function executeOpenConnectorAction(actionId, input, alias) {
  const token = ocToken();
  if (!token) {
    throw new Error('OPEN_CONNECTOR_TOKEN is not set.');
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
  if (alias && alias !== 'default') {
    headers['x-oo-connector-alias'] = alias;
  }
  const resp = await fetch(`${ocUrl()}/v1/actions/${actionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: input || {} }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.success === false) {
    const message = json?.message || json?.error?.message || `HTTP ${resp.status}`;
    const err = new Error(message);
    err.status = resp.status;
    err.errorCode = json?.errorCode;
    throw err;
  }
  return json?.data ?? json;
}

const summarizeMx = (data, check, domain) => {
  const failed = compactItems(data?.Failed);
  const warnings = compactItems(data?.Warnings);
  const passed = compactItems(data?.Passed);
  return {
    check,
    domain,
    command: data?.Command,
    mxRep: data?.MxRep,
    dnsServiceProvider: data?.DnsServiceProvider,
    failed,
    warnings,
    passed,
    information: Array.isArray(data?.Information) ? data.Information.slice(0, 12) : data?.Information,
  };
};

const runYoutubeStats = async (args) => {
  const handle = String(args?.handle || '').trim().replace(/^@/, '');
  const includeRecent = args?.includeRecent !== false;
  const maxRecent = Math.min(15, Math.max(1, Number(args?.maxRecent) || 8));
  const channelInput = handle
    ? { forHandle: `@${handle}`, part: ['snippet', 'statistics', 'contentDetails'] }
    : { mine: true, part: ['snippet', 'statistics', 'contentDetails'] };
  const listed = await executeOpenConnectorAction('youtube.list_channels', channelInput, ALIAS.youtube);
  const channel = (listed?.channels || listed?.items || [])[0];
  if (!channel) return 'No YouTube channel found for the connected account.';
  const stats = channel.statistics || {};
  const snippet = channel.snippet || {};
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  const summary = {
    id: channel.id,
    title: snippet.title,
    handle: snippet.customUrl,
    publishedAt: snippet.publishedAt,
    subscribers: stats.subscriberCount,
    views: stats.viewCount,
    videos: stats.videoCount,
  };
  if (!includeRecent || !uploads) {
    return JSON.stringify(summary);
  }
  const playlist = await executeOpenConnectorAction(
    'youtube.list_playlist_items',
    { playlistId: uploads, part: ['contentDetails', 'snippet'], maxResults: maxRecent },
    ALIAS.youtube,
  );
  const ids = (playlist?.playlistItems || playlist?.items || [])
    .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
    .filter(Boolean);
  if (ids.length === 0) return JSON.stringify({ ...summary, recent: [] });
  const videos = await executeOpenConnectorAction(
    'youtube.list_videos',
    { ids, part: ['snippet', 'statistics', 'status'] },
    ALIAS.youtube,
  );
  const recent = (videos?.videos || videos?.items || []).map((video) => ({
    id: video.id,
    title: video.snippet?.title,
    publishedAt: video.snippet?.publishedAt,
    views: video.statistics?.viewCount,
    likes: video.statistics?.likeCount,
    comments: video.statistics?.commentCount,
  }));
  return JSON.stringify({ ...summary, recent });
};

const runMxLookup = async (args) => {
  const domain = String(args?.domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0];
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return 'Provide a valid domain such as yishaik.com.';
  }
  const check = String(args?.check || 'dmarc').trim().toLowerCase();
  const actionId = MX_CHECKS[check];
  if (!actionId) {
    return `Unknown check "${check}". Use one of: ${Object.keys(MX_CHECKS).join(', ')}.`;
  }
  let input;
  if (check === 'dkim') {
    const selector = String(args?.selector || 'cf2024-1').trim();
    input = { domain: `${selector}._domainkey.${domain}` };
  } else if (check === 'blacklist' || check === 'ping') {
    input = { domain_or_ip: domain };
  } else {
    input = { domain };
  }
  const data = await executeOpenConnectorAction(actionId, input, ALIAS.mx_toolbox);
  return JSON.stringify(summarizeMx(data, check, domain));
};

const runTelegramNotify = async (args) => {
  const text = String(args?.text || '').trim();
  if (!text) return 'Message text is required.';
  const chatId = String(args?.chatId || process.env.OPEN_CONNECTOR_TELEGRAM_CHAT_ID || '').trim();
  if (!chatId) {
    return 'No Telegram chat id. Pass chatId or set OPEN_CONNECTOR_TELEGRAM_CHAT_ID.';
  }
  const data = await executeOpenConnectorAction(
    'telegram.send_message',
    { chatId, text: text.slice(0, 4096), disableWebPagePreview: true },
    ALIAS.telegram,
  );
  const message = data?.result || data?.message || data;
  return JSON.stringify({
    sent: true,
    chatId,
    messageId: message?.message_id || message?.messageId,
  });
};

export async function runOpenConnectorTool(name, args) {
  if (!isOpenConnectorConfigured()) {
    return 'Open Connector is not configured on the server (OPEN_CONNECTOR_TOKEN).';
  }
  try {
    if (name === 'youtube_stats') return await runYoutubeStats(args);
    if (name === 'mx_lookup') return await runMxLookup(args);
    if (name === 'telegram_notify') return await runTelegramNotify(args);
    return `Unknown Open Connector tool: ${name}`;
  } catch (error) {
    return `Open Connector error: ${error instanceof Error ? error.message : 'failed'}`;
  }
}
