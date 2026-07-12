import { NextResponse } from 'next/server';

let cachedToken: string | null = null;
let tokenExpiry = 0;

/**
 * Authenticates with Shiprocket API and retrieves cacheable Bearer token.
 */
async function getShiprocketToken(email: string, pass: string): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  try {
    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });

    if (!res.ok) {
      console.warn("Shiprocket auth endpoint rejected credentials.");
      return null;
    }

    const data = await res.json();
    if (data.token) {
      cachedToken = data.token;
      // Cache token for 23 hours (normally valid for 24+ hours)
      tokenExpiry = now + 23 * 60 * 60 * 1000;
      return cachedToken;
    }
  } catch (err) {
    console.error("Error authenticating with Shiprocket API:", err);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get('company');
    const tracking = searchParams.get('tracking');
    const shippedAtParam = searchParams.get('shippedAt');

    if (!company || !tracking) {
      return NextResponse.json({ error: 'Company and tracking parameters are required.' }, { status: 400 });
    }

    const shiprocketEmail = process.env.SHIPROCKET_EMAIL;
    const shiprocketPassword = process.env.SHIPROCKET_PASSWORD;

    // Check if Shiprocket credentials are set in .env.local
    const isShiprocketConfigured = shiprocketEmail && 
      shiprocketPassword && 
      !shiprocketEmail.includes("YOUR_") && 
      !shiprocketPassword.includes("YOUR_");

    if (isShiprocketConfigured) {
      const token = await getShiprocketToken(shiprocketEmail, shiprocketPassword);
      if (token) {
        try {
          const trackingRes = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${tracking}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });

          if (trackingRes.ok) {
            const trackData = await trackingRes.json();
            const details = trackData?.tracking_data;

            // Check if tracking details were returned successfully by Shiprocket
            if (details && details.track_status === 1) {
              const scans = details.scans || [];
              const timeline = scans.map((scan: any) => ({
                status: scan.activity || "Scan Update",
                location: scan.location || "Logistics Hub",
                time: scan.date ? new Date(scan.date).toISOString() : new Date().toISOString(),
                details: scan.activity || "Shipment status updated by carrier.",
              }));

              // Shiprocket sends scan timeline oldest-first, reverse to match UI (newest-first)
              timeline.reverse();

              return NextResponse.json({
                success: true,
                courier: company,
                trackingNumber: tracking,
                expectedDeliveryDate: details.etd || "",
                currentStatus: details.shipment_status || "In Transit",
                timeline,
              });
            }
          }
        } catch (err) {
          console.error("Real-time Shiprocket tracking query failed, falling back to simulation:", err);
        }
      }
    }

    // --- FALLBACK: Standard Simulation Timeline ---
    let shippedDate = new Date();
    if (shippedAtParam) {
      const parsed = new Date(shippedAtParam);
      if (!isNaN(parsed.getTime())) {
        shippedDate = parsed;
      }
    }

    let transitDays = 3;
    switch (company) {
      case 'Delhivery': transitDays = 3; break;
      case 'BlueDart': transitDays = 2; break;
      case 'DTDC': transitDays = 4; break;
      case 'FedEx': transitDays = 2; break;
      case 'XpressBees': transitDays = 4; break;
      case 'Ecom Express': transitDays = 4; break;
      case 'India Post': transitDays = 6; break;
      case 'Shadowfax': transitDays = 3; break;
      default: transitDays = 5;
    }

    const expectedDeliveryDate = new Date(shippedDate.getTime() + transitDays * 24 * 60 * 60 * 1000);
    const timeline = [];

    // Step 1: Manifest
    const manifestTime = new Date(shippedDate.getTime() - 2 * 60 * 60 * 1000);
    timeline.push({
      status: 'Manifest Created',
      location: 'Merchant Warehouse',
      time: manifestTime.toISOString(),
      details: 'Shipping details registered. Package is ready for pickup.',
    });

    // Step 2: Picked up
    timeline.push({
      status: 'Package Picked Up',
      location: `Local ${company} Facility`,
      time: shippedDate.toISOString(),
      details: `Package has been picked up by ${company} and is arriving at the sorting center.`,
    });

    const now = new Date();

    // Step 3: In Transit
    const transitTime = new Date(shippedDate.getTime() + 12 * 60 * 60 * 1000);
    if (now > transitTime) {
      timeline.push({
        status: 'In Transit',
        location: `Major Sorting Hub`,
        time: transitTime.toISOString(),
        details: 'Package has departed sorting facility and is in transit to the destination city.',
      });
    }

    // Step 4: Arrived Hub
    const midTransitTime = new Date(shippedDate.getTime() + (transitDays / 2) * 24 * 60 * 60 * 1000);
    if (now > midTransitTime) {
      timeline.push({
        status: 'Arrived at Delivery Hub',
        location: 'Destination Delivery Center',
        time: midTransitTime.toISOString(),
        details: `Package received at regional logistics center. Outbound sorting in progress.`,
      });
    }

    // Step 5: Out for delivery
    const outForDeliveryTime = new Date(expectedDeliveryDate.getTime() - 4 * 60 * 60 * 1000);
    if (now > outForDeliveryTime) {
      timeline.push({
        status: 'Out for Delivery',
        location: 'Destination City',
        time: outForDeliveryTime.toISOString(),
        details: `Package is loaded into delivery vehicle. Out for delivery today.`,
      });
    }

    let currentStatus = 'In Transit';
    if (now > expectedDeliveryDate) {
      currentStatus = 'Delivered';
      timeline.push({
        status: 'Delivered',
        location: 'Customer Address',
        time: expectedDeliveryDate.toISOString(),
        details: 'Package delivered. Signed by recipient.',
      });
    } else if (now > outForDeliveryTime) {
      currentStatus = 'Out for Delivery';
    } else if (now > midTransitTime) {
      currentStatus = 'Package at Local Facility';
    }

    timeline.reverse();

    return NextResponse.json({
      success: true,
      courier: company,
      trackingNumber: tracking,
      expectedDeliveryDate: expectedDeliveryDate.toISOString(),
      currentStatus,
      timeline,
    });

  } catch (error) {
    console.error('Tracking API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
