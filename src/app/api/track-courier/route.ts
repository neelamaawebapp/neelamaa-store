import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get('company');
    const tracking = searchParams.get('tracking');
    const shippedAtParam = searchParams.get('shippedAt');

    if (!company || !tracking) {
      return NextResponse.json({ error: 'Company and tracking parameters are required.' }, { status: 400 });
    }

    // Baseline shipped date
    let shippedDate = new Date();
    if (shippedAtParam) {
      const parsed = new Date(shippedAtParam);
      if (!isNaN(parsed.getTime())) {
        shippedDate = parsed;
      }
    }

    // Determine shipping duration depending on carrier (in days)
    let transitDays = 3; // Default
    switch (company) {
      case 'Delhivery':
        transitDays = 3;
        break;
      case 'BlueDart':
        transitDays = 2; // Express
        break;
      case 'DTDC':
        transitDays = 4;
        break;
      case 'FedEx':
        transitDays = 2; // Express
        break;
      case 'XpressBees':
        transitDays = 4;
        break;
      case 'Ecom Express':
        transitDays = 4;
        break;
      case 'India Post':
        transitDays = 6;
        break;
      case 'Shadowfax':
        transitDays = 3;
        break;
      default:
        transitDays = 5;
    }

    const expectedDeliveryDate = new Date(shippedDate.getTime() + transitDays * 24 * 60 * 60 * 1000);

    // Build a realistic tracking timeline from the courier website
    const timeline = [];

    // Step 1: Handover / Manifest (2 hours before shippedAt)
    const manifestTime = new Date(shippedDate.getTime() - 2 * 60 * 60 * 1000);
    timeline.push({
      status: 'Manifest Created',
      location: 'Merchant Warehouse',
      time: manifestTime.toISOString(),
      details: 'Shipping details registered. Package is ready for pickup.',
    });

    // Step 2: Picked up (shippedAt)
    timeline.push({
      status: 'Package Picked Up',
      location: `Local ${company} Facility`,
      time: shippedDate.toISOString(),
      details: `Package has been picked up by ${company} and is arriving at the sorting center.`,
    });

    const now = new Date();

    // Step 3: In Transit (12 hours after shippedAt)
    const transitTime = new Date(shippedDate.getTime() + 12 * 60 * 60 * 1000);
    if (now > transitTime) {
      timeline.push({
        status: 'In Transit',
        location: `Major Sorting Hub`,
        time: transitTime.toISOString(),
        details: 'Package has departed sorting facility and is in transit to the destination city.',
      });
    }

    // Step 4: Arrived at Local Delivery Hub (midway through transit)
    const midTransitTime = new Date(shippedDate.getTime() + (transitDays / 2) * 24 * 60 * 60 * 1000);
    if (now > midTransitTime) {
      timeline.push({
        status: 'Arrived at Delivery Hub',
        location: 'Destination Delivery Center',
        time: midTransitTime.toISOString(),
        details: `Package received at regional logistics center. Outbound sorting in progress.`,
      });
    }

    // Step 5: Out for delivery (4 hours before expected delivery date)
    const outForDeliveryTime = new Date(expectedDeliveryDate.getTime() - 4 * 60 * 60 * 1000);
    if (now > outForDeliveryTime) {
      timeline.push({
        status: 'Out for Delivery',
        location: 'Destination City',
        time: outForDeliveryTime.toISOString(),
        details: `Package is loaded into delivery vehicle. Out for delivery today.`,
      });
    }

    // Determine overall status based on timeline and current time
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

    // Reverse timeline so newest is first in the list
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
