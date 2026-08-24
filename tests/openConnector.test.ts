import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.OPEN_CONNECTOR_TOKEN;
  delete process.env.OPEN_CONNECTOR_URL;
  delete process.env.OPEN_CONNECTOR_TELEGRAM_CHAT_ID;
  vi.resetModules();
});

describe('runOpenConnectorTool', () => {
  it('explains when the token is missing', async () => {
    const { runOpenConnectorTool } = await import('../lib/openConnector.js');
    await expect(runOpenConnectorTool('mx_lookup', { domain: 'yishaik.com', check: 'dmarc' })).resolves.toMatch(
      /not configured/i,
    );
  });

  it('rejects an unknown mx check without calling Open Connector', async () => {
    process.env.OPEN_CONNECTOR_TOKEN = 'oct_test';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { runOpenConnectorTool } = await import('../lib/openConnector.js');
    const out = await runOpenConnectorTool('mx_lookup', { domain: 'yishaik.com', check: 'explode' });
    expect(out).toMatch(/Unknown check/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps dmarc lookup to the MxToolbox alias and action', async () => {
    process.env.OPEN_CONNECTOR_TOKEN = 'oct_test';
    process.env.OPEN_CONNECTOR_URL = 'https://connect.yishaik.com';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          Command: 'dmarc',
          Failed: [],
          Warnings: [],
          Passed: [{ Name: 'DMARC Record Published', Info: 'DMARC Record found' }],
        },
      }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { runOpenConnectorTool } = await import('../lib/openConnector.js');
    const out = await runOpenConnectorTool('mx_lookup', { domain: 'https://Yishaik.com/path', check: 'dmarc' });
    expect(JSON.parse(out).passed[0].name).toBe('DMARC Record Published');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const mxCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const url = mxCall[0];
    const init = mxCall[1];
    expect(url).toBe('https://connect.yishaik.com/v1/actions/mx_toolbox.lookup_dmarc');
    expect((init.headers as Record<string, string>)['x-oo-connector-alias']).toBe('MxToolbox-theyishaik');
    expect(JSON.parse(String(init.body)).input.domain).toBe('yishaik.com');
  });

  it('sends telegram through the ops connection', async () => {
    process.env.OPEN_CONNECTOR_TOKEN = 'oct_test';
    process.env.OPEN_CONNECTOR_TELEGRAM_CHAT_ID = '@ops_channel';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: { result: { message_id: 9 } } }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { runOpenConnectorTool } = await import('../lib/openConnector.js');
    const out = await runOpenConnectorTool('telegram_notify', { text: 'hello from WhatsAI' });
    expect(JSON.parse(out)).toEqual({ sent: true, chatId: '@ops_channel', messageId: 9 });
    const tgCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const url = tgCall[0];
    const init = tgCall[1];
    expect(url).toContain('telegram.send_message');
    expect((init.headers as Record<string, string>)['x-oo-connector-alias']).toBe('ops');
  });
});
