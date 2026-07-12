// Native global fetch will be used

// Note: Ensure your local dev server is running on http://localhost:3000
const BASE_URL = "http://localhost:3000";

const tests = [
  // 1. Unauthenticated checks (Should all return 401)
  {
    name: "GET /api/wallet/balance (No Auth) - Expected: 401",
    url: `${BASE_URL}/api/wallet/balance?userId=mock_test_uid`,
    options: { method: "GET" },
    expectedStatus: 401,
  },
  {
    name: "POST /api/wallet/debit (No Auth) - Expected: 401",
    url: `${BASE_URL}/api/wallet/debit`,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "mock_test_uid", orderId: "123", amount: 10 })
    },
    expectedStatus: 401,
  },
  {
    name: "POST /api/wallet/credit-cashback (No Auth) - Expected: 401",
    url: `${BASE_URL}/api/wallet/credit-cashback`,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "mock_order_123", userId: "mock_test_uid", mockOrderTotal: 100 })
    },
    expectedStatus: 401,
  },
  {
    name: "POST /api/send-broadcast (No Auth) - Expected: 401",
    url: `${BASE_URL}/api/send-broadcast`,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Spam Alert", message: "Hack!" })
    },
    expectedStatus: 401,
  },
  {
    name: "POST /api/wallet/admin-settings (No Auth) - Expected: 401",
    url: `${BASE_URL}/api/wallet/admin-settings`,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupBonus: 9999 })
    },
    expectedStatus: 401,
  },

  // 2. Regular User Mock Auth checks (Should succeed or fail correctly)
  {
    name: "GET /api/wallet/balance (Valid Owner Auth) - Expected: 200",
    url: `${BASE_URL}/api/wallet/balance?userId=mock_test_uid`,
    options: {
      method: "GET",
      headers: { "Authorization": "Bearer mock_test@example.com_mock_test_uid" }
    },
    expectedStatus: 200,
  },
  {
    name: "GET /api/wallet/balance (Wrong Owner Auth) - Expected: 403",
    url: `${BASE_URL}/api/wallet/balance?userId=mock_other_uid`,
    options: {
      method: "GET",
      headers: { "Authorization": "Bearer mock_test@example.com_mock_test_uid" }
    },
    expectedStatus: 403,
  },
  {
    name: "POST /api/send-broadcast (Regular User Auth) - Expected: 403",
    url: `${BASE_URL}/api/send-broadcast`,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock_test@example.com_mock_test_uid"
      },
      body: JSON.stringify({ title: "Spam Alert", message: "Hack!" })
    },
    expectedStatus: 403,
  },

  // 3. Admin Mock Auth checks (Should bypass checks and hit endpoint logic)
  {
    name: "POST /api/send-broadcast (Admin Auth) - Expected: 400 (Auth passed, missing body params)",
    url: `${BASE_URL}/api/send-broadcast`,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer mock_admin@craftstyle.com_mock_admin_uid"
      },
      body: JSON.stringify({}) // Missing required title/message
    },
    expectedStatus: 400,
  },
];

async function runTests() {
  console.log("=== STARTING SECURITY ENDPOINT VERIFICATION TESTS ===\n");
  let passedCount = 0;
  let failedCount = 0;

  for (const test of tests) {
    try {
      const res = await fetch(test.url, test.options);
      if (res.status === test.expectedStatus) {
        console.log(`[PASS] ${test.name}`);
        passedCount++;
      } else {
        const bodyText = await res.text();
        console.error(`[FAIL] ${test.name}\n       Expected: ${test.expectedStatus}, Received: ${res.status}\n       Response: ${bodyText.slice(0, 150)}`);
        failedCount++;
      }
    } catch (err) {
      console.error(`[ERR]  ${test.name}\n       Connection failed: Is the Next.js dev server running on http://localhost:3000?`);
      console.error(`       Error details: ${err.message}`);
      failedCount++;
    }
  }

  console.log(`\n=== TEST SUMMARY ===`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  
  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
