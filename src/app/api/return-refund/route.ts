import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { 
      orderId, 
      itemIndex, 
      userId, 
      customerName, 
      customerEmail, 
      requestType, 
      reason, 
      comments, 
      proofUrl 
    } = await req.json();

    if (!orderId || itemIndex === undefined || !userId || !customerName || !customerEmail || !requestType || !reason) {
      return NextResponse.json({ error: "Missing required fields for return request." }, { status: 400 });
    }

    // 1. Initialize Firestore Lite
    const { getFirestore, collection, addDoc, doc, getDoc, updateDoc } = await import("firebase/firestore/lite");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // 2. Fetch the order and get item details first
    let itemDetails: any = null;
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        if (orderData.items && orderData.items[itemIndex]) {
          itemDetails = orderData.items[itemIndex];
        }
      }
    } catch (orderErr) {
      console.error("Failed to retrieve order details for return request:", orderErr);
    }

    // 3. Create the return request document with embedded itemDetails
    const returnRequestsRef = collection(db, "returnRequests");
    const newRequest = {
      orderId,
      itemIndex,
      userId,
      customerName,
      customerEmail,
      requestType,
      reason,
      comments: comments || "",
      proofUrl: proofUrl || "",
      status: "Pending", // Pending, Approved, Rejected
      createdAt: new Date().toISOString(),
      itemDetails: itemDetails || null
    };
    
    const docRef = await addDoc(returnRequestsRef, newRequest);
    const returnRequestId = docRef.id;

    // 4. Update the returnStatus of the specific item in the order
    let orderUpdated = false;
    if (itemDetails) {
      try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const updatedItems = [...(orderData.items || [])];
          
          if (updatedItems[itemIndex]) {
            updatedItems[itemIndex] = {
              ...updatedItems[itemIndex],
              returnStatus: "Requested",
              returnRequestId: returnRequestId,
              returnRequestType: requestType
            };
            
            await updateDoc(orderRef, { items: updatedItems });
            orderUpdated = true;
          }
        }
      } catch (orderErr) {
        console.error("Failed to update order return status in Firestore:", orderErr);
      }
    }

    // 5. Send Email Notification to Admin using Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 3000,
    });

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "neelsutra1@gmail.com";
    const mailOptions = {
      from: `"NeelSutra Support" <${process.env.EMAIL_USER || 'support@neelsutra.com'}>`,
      to: adminEmail,
      subject: `New Return/Refund Request - Order #${orderId.slice(-8).toUpperCase()}`,
      html: `
        <div style="font-family: sans-serif; padding: 25px; color: #333; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #ec4899; margin: 0; font-family: serif; font-size: 28px;">NeelSutra</h1>
          </div>
          
          <h2 style="font-size: 18px; color: #1e293b; margin-top: 0; border-b: 1px solid #f1f5f9; padding-bottom: 10px;">
            New Return / Refund Request Received
          </h2>
          
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            A customer has initiated a <strong>${requestType}</strong> request for an item in Order <strong>#${orderId.slice(-8).toUpperCase()}</strong>.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 20px 0; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #475569; width: 140px; border-bottom: 1px solid #e2e8f0;">Customer Name:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Customer Email:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${customerEmail}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Request Type:</td>
              <td style="padding: 10px; color: #ec4899; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${requestType}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Reason:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${reason}</td>
            </tr>
            ${itemDetails ? `
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Item Returned:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                <strong>${itemDetails.brand}</strong> - ${itemDetails.title} 
                ${itemDetails.size ? `<br/>Size: ${itemDetails.size}` : ''}
                <br/>Price: ₹${itemDetails.price} | Qty: ${itemDetails.quantity}
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">Comments:</td>
              <td style="padding: 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-style: italic;">
                ${comments || "No comment provided."}
              </td>
            </tr>
            ${proofUrl ? `
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #475569;">Attachment / Proof:</td>
              <td style="padding: 10px; color: #0f172a;">
                <a href="${proofUrl}" target="_blank" style="color: #ec4899; font-weight: bold; text-decoration: underline;">View Uploaded Evidence</a>
              </td>
            </tr>
            ` : ''}
          </table>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;"/>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">
            Please log in to the NeelSutra Admin Panel to review this return request, inspect the item conditions, and manage the Razorpay refund if approved.
          </p>
        </div>
      `,
    };

    let emailSent = false;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail(mailOptions);
        emailSent = true;
      } catch (mailError) {
        console.error("Nodemailer failed to send return notification email to admin:", mailError);
      }
    } else {
      console.warn("SMTP credentials not configured. Return email notification skipped.");
    }

    return NextResponse.json({ 
      success: true, 
      returnRequestId,
      orderUpdated,
      emailSent,
      message: "Return request submitted successfully." 
    });

  } catch (error: any) {
    console.error("Return refund API error:", error);
    return NextResponse.json({ error: error.message || "Failed to process return request." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { returnRequestId, status } = await req.json();

    if (!returnRequestId || !status || !["Approved", "Rejected"].includes(status)) {
      return NextResponse.json({ error: "Missing or invalid fields for return status update." }, { status: 400 });
    }

    // Initialize Firestore Lite
    const { getFirestore, doc, getDoc, updateDoc } = await import("firebase/firestore/lite");
    const { app } = await import("@/lib/firebase");
    const db = getFirestore(app);

    // Get return request details
    const returnRequestRef = doc(db, "returnRequests", returnRequestId);
    const returnRequestSnap = await getDoc(returnRequestRef);

    if (!returnRequestSnap.exists()) {
      return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    }

    const returnRequestData = returnRequestSnap.data();
    const { orderId, itemIndex } = returnRequestData;

    // Update return request status
    await updateDoc(returnRequestRef, { status });

    // Update the corresponding order item status
    let orderUpdated = false;
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);

      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const updatedItems = [...(orderData.items || [])];

        if (updatedItems[itemIndex]) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            returnStatus: status // Approved or Rejected
          };

          await updateDoc(orderRef, { items: updatedItems });
          orderUpdated = true;
        }
      }
    } catch (orderErr) {
      console.error("Failed to update order status during admin review:", orderErr);
    }

    return NextResponse.json({
      success: true,
      status,
      orderUpdated,
      message: `Return request ${status.toLowerCase()} successfully.`
    });
  } catch (error: any) {
    console.error("Return status update error:", error);
    return NextResponse.json({ error: error.message || "Failed to update return request status." }, { status: 500 });
  }
}
