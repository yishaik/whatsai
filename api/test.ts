export default async function handler(_req: any, res: any) {
  // Test environment variables
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasApiKey = !!process.env.API_KEY;
  const keyLength = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').length;
  
  return res.status(200).json({
    hasGeminiKey,
    hasApiKey,
    keyLength,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
}
