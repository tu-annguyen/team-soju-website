const http = require('http');
const worker = require('./worker');

const port = Number(process.env.DISCORD_BOT_PORT || 8787);

const server = http.createServer(async (req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    const url = `http://${req.headers.host || `localhost:${port}`}${req.url}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });

    try {
      const response = await worker.fetch(request, process.env, {
        waitUntil: promise => promise.catch(error => console.error('Background task failed:', error)),
      });

      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      const responseBody = Buffer.from(await response.arrayBuffer());
      res.end(responseBody);
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
});

server.listen(port, '0.0.0.0', async () => {
  try {
    await worker.registerCommandsIfNeeded(process.env);
  } catch (error) {
    console.error('Command registration failed:', error);
  }
  console.log(`Discord interaction dev server listening on http://0.0.0.0:${port}`);
});
