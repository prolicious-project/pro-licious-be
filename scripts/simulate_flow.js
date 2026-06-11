/*
Simple script to simulate vendor marking an order READY and a rider connecting via Socket.IO
Usage:
  NODE_ENV=development node scripts/simulate_flow.js
Requires: node-fetch and socket.io-client installed globally or in project.

Set environment variables or edit constants below.
*/
const fetch = require('node-fetch');
const { io } = require('socket.io-client');

const API = process.env.API_URL || 'http://localhost:5000';
const VENDOR_EMAIL = process.env.VENDOR_EMAIL || 'vendor@example.com';
const VENDOR_PASS = process.env.VENDOR_PASS || 'password123';
const RIDER_EMAIL = process.env.RIDER_EMAIL || 'rider@example.com';
const RIDER_PASS = process.env.RIDER_PASS || 'password123';

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

(async () => {
  try {
    console.log('Logging in vendor...');
    const v = await login(VENDOR_EMAIL, VENDOR_PASS);
    const vendorToken = v?.data?.token || v?.token;
    if (!vendorToken) return console.error('Vendor login failed', v);

    console.log('Logging in rider...');
    const r = await login(RIDER_EMAIL, RIDER_PASS);
    const riderToken = r?.data?.token || r?.token;
    if (!riderToken) return console.error('Rider login failed', r);

    // connect rider socket
    console.log('Connecting rider socket...');
    const socket = io(`${API}`, { auth: { token: riderToken }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => console.log('Rider socket connected', socket.id));
    socket.on('pending_assignments', (d) => console.log('Pending assignments:', d));
    socket.on('rider_assigned', (d) => console.log('Rider assigned event:', d));

    // wait briefly, then mark an order ready as vendor
    setTimeout(async () => {
      const ORDER_ID = process.env.ORDER_ID || '1';
      console.log('Marking order ready:', ORDER_ID);
      const res = await fetch(`${API}/api/vendor/orders/${ORDER_ID}/ready`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vendorToken}` },
      });
      const data = await res.json();
      console.log('Mark ready response:', data);
    }, 1500);
  } catch (err) {
    console.error(err);
  }
})();
