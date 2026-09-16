export const prerender = true;

export function GET() {
  return new Response(JSON.stringify({ buildId: import.meta.env.PUBLIC_APP_BUILD_ID }), {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
