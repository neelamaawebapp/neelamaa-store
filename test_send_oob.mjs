import fs from 'fs';

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val.trim();
  }
});

const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function check(email) {
  console.log(`Calling sendOobCode without returnOobLink for: ${email}`);
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: email
      })
    });
    const data = await res.json();
    console.log(`Status for ${email}:`, res.status);
    console.log(`Response for ${email}:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

async function run() {
  await check('manishagaur1983@gmail.com');
  console.log('\n--------------------\n');
  await check('guddu20484@gmail.com');
}

run();
