import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 1. Enforce admin credentials
    const { verifyAdminRequest } = await import("@/lib/auth-server");
    await verifyAdminRequest(req);

    const { shipmentId, trackingNumber } = await req.json();
    let targetShipmentId = shipmentId;

    // 2. Fetch the shared Shiprocket token
    const { getShiprocketToken } = await import("@/lib/shiprocket");
    const token = await getShiprocketToken();
    if (!token) {
      return NextResponse.json({ error: "Shiprocket credentials are not configured on the server." }, { status: 500 });
    }

    // 3. Look up Shipment ID using AWB tracking number if shipmentId is missing
    if (!targetShipmentId && trackingNumber) {
      try {
        const lookupRes = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${trackingNumber}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (lookupRes.ok) {
          const trackData = await lookupRes.json();
          targetShipmentId = trackData?.tracking_data?.shipment_id;
        }
      } catch (lookupErr) {
        console.error("Failed to resolve AWB to Shipment ID via Shiprocket:", lookupErr);
      }
    }

    if (!targetShipmentId) {
      return NextResponse.json({ error: "Could not find shipment ID matching tracking number." }, { status: 400 });
    }

    // 4. Request the Manifest PDF from Shiprocket
    const printRes = await fetch("https://apiv2.shiprocket.in/v1/external/manifests/print", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: [Number(targetShipmentId)]
      })
    });

    const printData = await printRes.json();

    if (!printRes.ok || !printData.manifest_url) {
      return NextResponse.json({ error: printData.message || "Failed to generate print manifest." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      manifestUrl: printData.manifest_url
    });

  } catch (error: any) {
    console.error("Print Manifest API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to print shipping manifest." }, { status: 500 });
  }
}
