// Client helper for voice-message transcription via /api/transcribe.
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || ''); // strip the data: URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const transcribeAudio = async (blob: Blob): Promise<string> => {
  const audioBase64 = await blobToBase64(blob);
  const resp = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType: blob.type || 'audio/webm' }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error || `Transcription failed (${resp.status})`);
  return String(data.text || '');
};
