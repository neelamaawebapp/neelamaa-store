import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      delivery_postcode, 
      weight = 0.5, 
      cod = 0, 
      length = 10, 
      width = 10, 
      height = 10 
    } = body;

    if (!delivery_postcode) {
      return NextResponse.json({ 
        success: false, 
        message: "Delivery postcode is required." 
      }, { status: 400 });
    }

    const shiprocketEmail = process.env.SHIPROCKET_EMAIL;
    const shiprocketPassword = process.env.SHIPROCKET_PASSWORD;
    const pickupPostcode = process.env.SHIPROCKET_PICKUP_POSTCODE || "342008"; // Default to Jodhpur

    const isShiprocketConfigured = 
      shiprocketEmail && 
      shiprocketPassword && 
      !shiprocketEmail.includes("YOUR_") && 
      !shiprocketPassword.includes("YOUR_");

    if (isShiprocketConfigured) {
      try {
        const { getShiprocketToken } = await import("@/lib/shiprocket");
        const token = await getShiprocketToken();
        
        if (token) {
          const params = new URLSearchParams({
            pickup_postcode: pickupPostcode,
            delivery_postcode: String(delivery_postcode).trim(),
            weight: String(weight),
            cod: String(cod),
            length: String(length),
            width: String(width),
            height: String(height)
          });

          const serviceabilityRes = await fetch(
            `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${params.toString()}`,
            {
              headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              }
            }
          );

          if (serviceabilityRes.ok) {
            const resData = await serviceabilityRes.json();
            const companies = resData?.data?.available_courier_companies;
            
            if (companies && Array.isArray(companies) && companies.length > 0) {
              // Find the cheapest active courier
              const cheapest = companies.reduce((min: any, c: any) => {
                const rate = Number(c.rate || c.freight_charge || 999999);
                return rate < min.rate ? { name: c.courier_name, rate } : min;
              }, { name: "", rate: 999999 });

              if (cheapest.rate !== 999999) {
                return NextResponse.json({
                  success: true,
                  source: "Shiprocket API",
                  courier: cheapest.name,
                  shippingCost: Math.round(cheapest.rate),
                  pickupPostcode
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Shiprocket serviceability query failed, using fallback:", err);
      }
    }

    // --- FALLBACK LOGIC: Regional India Post zones ---
    const cleanPin = String(delivery_postcode).trim();
    const firstDigit = cleanPin.charAt(0);
    
    let baseRate = 75; // Zone B (North India) default
    let zoneName = "North India (Zone B)";

    switch (firstDigit) {
      case "3":
        baseRate = 55;
        zoneName = "Rajasthan/Gujarat Local (Zone A)";
        break;
      case "1":
      case "2":
        baseRate = 75;
        zoneName = "North India (Zone B)";
        break;
      case "4":
      case "5":
      case "6":
        baseRate = 95;
        zoneName = "West/South India (Zone C)";
        break;
      case "7":
      case "8":
        baseRate = 115;
        zoneName = "East/North-East (Zone D)";
        break;
      case "9":
        baseRate = 135;
        zoneName = "Army/Remote (Zone E)";
        break;
      default:
        baseRate = 75;
        zoneName = "National Standard";
    }

    // Weight Increment: +₹25 per additional kg above the first 1kg
    const weightInKg = Math.max(0.5, Number(weight));
    const additionalWeight = Math.max(0, weightInKg - 1);
    const weightCharge = Math.ceil(additionalWeight) * 25;

    // COD fee: +₹40
    const codCharge = Number(cod) === 1 ? 40 : 0;

    const totalShipping = baseRate + weightCharge + codCharge;

    return NextResponse.json({
      success: true,
      source: "Local Simulation Fallback",
      courier: "Standard Courier",
      shippingCost: totalShipping,
      zone: zoneName,
      pickupPostcode
    });

  } catch (error: any) {
    console.error("Shipping API error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Failed to calculate shipping cost" 
    }, { status: 500 });
  }
}
