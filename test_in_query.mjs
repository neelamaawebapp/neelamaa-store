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

const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'antigravitywebapp';

console.log('Testing Firestore REST API IN query for project:', projectId);

async function run() {
  try {
    // We will query documents in users collection with an IN query
    // In REST API, we can use structuredQuery
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    
    // We want to verify if the query works
    // For email: ['manishagaur1983@gmail.com']
    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: 'orders' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'customerEmail' },
            op: 'IN',
            value: {
              arrayValue: {
                values: [
                  { stringValue: 'manishagaur1983@gmail.com' }
                ]
              }
            }
          }
        }
      }
    };

    const startTime = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryPayload)
    });
    const duration = Date.now() - startTime;

    console.log(`Query took ${duration}ms, Status: ${res.status}`);
    if (!res.ok) {
      console.error('Error payload:', await res.text());
    } else {
      const data = await res.json();
      console.log('Query Results count:', data.length);
      console.log('Results:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

run();
