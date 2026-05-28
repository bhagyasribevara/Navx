const localtunnel = require('localtunnel');

async function startTunnel() {
  console.log('Starting localtunnel...');
  try {
    const tunnel = await localtunnel({ port: 5000, subdomain: 'navx-backend-test-123' });
    console.log(`TUNNEL_URL=${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('Tunnel closed! Restarting in 2 seconds...');
      setTimeout(startTunnel, 2000);
    });
    
    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Failed to start tunnel:', err);
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();
