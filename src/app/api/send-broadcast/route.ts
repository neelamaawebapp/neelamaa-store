import { NextResponse } from 'next/server';
import webpush from 'web-push';

export async function POST(req: Request) {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      console.error("VAPID keys are missing in environment variables.");
      return NextResponse.json({ error: 'Web Push VAPID keys are not configured.' }, { status: 500 });
    }

    // Configure Web Push with VAPID details lazily
    webpush.setVapidDetails(
      'mailto:admincraftstyle@gmail.com',
      publicKey,
      privateKey
    );

    const { title, message } = await req.json();

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing required parameters: title, message' }, { status: 400 });
    }

    // 1. Initialize Firestore Lite
    const { getFirestore, collection, getDocs, deleteDoc, doc } = await import("firebase/firestore/lite");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // 2. Fetch all push subscriptions
    const subsRef = collection(db, "push_subscriptions");
    const querySnapshot = await getDocs(subsRef);

    if (querySnapshot.empty) {
      return NextResponse.json({ success: true, count: 0, message: "No push subscriptions found." });
    }

    const subscriptions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    let successCount = 0;
    let failureCount = 0;

    // 3. Send Web Push to each subscriber
    const payload = JSON.stringify({ title, message });

    for (const sub of subscriptions) {
      try {
        if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
          console.warn("Skipping invalid subscription:", sub.id);
          continue;
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        };

        await webpush.sendNotification(pushSubscription, payload);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to send web push to ${sub.endpoint}:`, err);
        failureCount++;
        
        // Clean up expired/invalid subscriptions (HTTP 410 Gone / 404 Not Found)
        if (err.statusCode === 410 || err.statusCode === 404) {
          try {
            const docRef = doc(db, "push_subscriptions", sub.id);
            await deleteDoc(docRef);
            console.log(`Successfully deleted expired push subscription: ${sub.id}`);
          } catch (delErr) {
            console.error(`Failed to delete expired subscription ${sub.id}:`, delErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      total: subscriptions.length,
      sent: successCount,
      failed: failureCount
    });

  } catch (error: any) {
    console.error('Send Broadcast API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
