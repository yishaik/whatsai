// Server-only Open Connector client. Used by api/persona-response.ts.
// Dedicated runtime token — never the admin token.

const DEFAULT_URL = 'https://connect.yishaik.com';
// Zone Bot Fight Mode (Free) cannot be skipped and 403s datacenter IPs
// such as Vercel. workers.dev is the same Worker, outside the zone.
const FALLBACK_URL = 'https://open-connector-api.yishai-k.workers.dev';
const CHANNEL_ID_RE = /^UC[\w-]{20,24}$/;
const PART_CHANNEL = ['snippet', 'statistics', 'contentDetails'];

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

const stripSlash = (value) => String(value || '').replace(/\/+$/, '');

const ocUrl = () => stripSlash(process.env.OPEN_CONNECTOR_URL || DEFAULT_URL);

const ocFallbackUrl = () => {
  const explicit = stripSlash(process.env.OPEN_CONNECTOR_FALLBACK_URL || '');
  if (explicit) return explicit;
  const primary = ocUrl();
  if (primary.includes('workers.dev')) return DEFAULT_URL;
  return FALLBACK_URL;
};

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

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isEdgeBlock = (resp, json, text) => {
  if (json && (json.error || json.errorCode || json.success === false)) return false;
  if (![401, 403, 404].includes(resp.status)) return false;
  const mitigated = resp.headers.get('cf-mitigated') || resp.headers.get('cf-ray');
  const html = /<!DOCTYPE html|<html|Attention Required|just a moment/i.test(String(text || ''));
  if (html || resp.headers.get('cf-mitigated')) return true;
  if (resp.status === 403 && !json) return true;
  if (resp.status === 404 && !json && mitigated) return true;
  return false;
};

const formatOcError = (resp, json, text) => {
  const apiMessage = json?.message || json?.error?.message;
  if (apiMessage) return String(apiMessage);
  const body = clip(String(text || '').replace(/\s+/g, ' '), 160);
  if (resp.status === 403 && (!json || /Attention Required|just a moment/i.test(body))) {
    return 'HTTP 403 from Cloudflare Bot Fight on the custom domain.';
  }
  return body ? `HTTP ${resp.status}: ${body}` : `HTTP ${resp.status}`;
};

const postAction = async (baseUrl, actionId, input, headers) => {
  const resp = await fetch(`${baseUrl}/v1/actions/${actionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: input || {} }),
  });
  const text = await resp.text();
  const json = parseJson(text);
  return { resp, text, json, baseUrl };
};

const throwOcError = (resp, json, text) => {
  const err = new Error(formatOcError(resp, json, text));
  err.status = resp.status;
  err.errorCode = json?.errorCode || json?.error?.code;
  throw err;
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
  const primary = ocUrl();
  const fallback = ocFallbackUrl();
  const first = await postAction(primary, actionId, input, headers);
  if (first.resp.ok && first.json?.success !== false) {
    return first.json?.data ?? first.json;
  }
  if (fallback && fallback !== primary && isEdgeBlock(first.resp, first.json, first.text)) {
    console.warn(`Open Connector ${first.resp.status} at ${primary}; retrying ${fallback}`);
    const second = await postAction(fallback, actionId, input, headers);
    if (second.resp.ok && second.json?.success !== false) {
      return second.json?.data ?? second.json;
    }
    throwOcError(second.resp, second.json, second.text);
  }
  throwOcError(first.resp, first.json, first.text);
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

const channelFilter = (args) => {
  const rawId = String(args?.channelId || '').trim();
  const rawHandle = String(args?.handle || '').trim();
  if (CHANNEL_ID_RE.test(rawId)) return { ids: [rawId], part: PART_CHANNEL };
  if (CHANNEL_ID_RE.test(rawHandle)) return { ids: [rawHandle], part: PART_CHANNEL };
  if (rawHandle) return { forHandle: `@${rawHandle.replace(/^@/, '')}`, part: PART_CHANNEL };
  return { mine: true, part: PART_CHANNEL };
};

const runYoutubeStats = async (args) => {
  const includeRecent = args?.includeRecent !== false;
  const maxRecent = Math.min(15, Math.max(1, Number(args?.maxRecent) || 8));
  const listed = await executeOpenConnectorAction('youtube.list_channels', channelFilter(args), ALIAS.youtube);
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
