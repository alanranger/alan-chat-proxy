import fetch from 'node-fetch';

async function main() {
  const url = 'https://alan-chat-proxy.vercel.app/api/chat';
  const payload = { query: 'ping', sessionId: 'debug', previousQuery: null };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('HEADERS:', Object.fromEntries(res.headers.entries()));
    console.log('BODY:', text);
  } catch (e) {
    console.error('REQUEST ERROR:', e.message);
  }
}

main();


