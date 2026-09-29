function jsonResponse(body, status, headers) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function decodeFirestoreField(field) {
    if (!field) return undefined;
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.integerValue !== undefined) return Number(field.integerValue);
    if (field.doubleValue !== undefined) return Number(field.doubleValue);
    if (field.booleanValue !== undefined) return field.booleanValue;
    if (field.nullValue !== undefined) return null;
    return undefined;
}

export default {
    async fetch(request, env) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': env.SITE_ORIGIN,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'no-store',
            Vary: 'Origin'
        };

        const origin = request.headers.get('Origin');
        if (origin && origin !== env.SITE_ORIGIN) {
            return jsonResponse({ error: 'Origin not allowed.' }, 403, corsHeaders);
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }
        if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/payments/initialize') {
            return jsonResponse({ error: 'Not found.' }, 404, corsHeaders);
        }

        try {
            const { orderId, orderNumber } = await request.json();
            if (typeof orderId !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(orderId) || typeof orderNumber !== 'string') {
                return jsonResponse({ error: 'A valid order reference is required.' }, 400, corsHeaders);
            }

            const firestoreUrl = new URL(
                `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${encodeURIComponent(orderId)}`
            );
            firestoreUrl.searchParams.set('key', env.FIREBASE_API_KEY);
            const orderResponse = await fetch(firestoreUrl);
            if (!orderResponse.ok) {
                return jsonResponse({ error: 'Order not found.' }, 404, corsHeaders);
            }

            const document = await orderResponse.json();
            const fields = document.fields || {};
            const order = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreField(value)]));
            const configuredAmount = order.amountDue ?? order.paymentAmount ?? order.PaymentAmmount;
            const amountDue = typeof configuredAmount === 'number' ? configuredAmount : Number(configuredAmount);
            const currency = String(order.currency ?? order.amountCurrency ?? 'GHS').trim().toUpperCase();
            const email = typeof order.customerEmail === 'string' ? order.customerEmail.trim() : '';

            if (order.orderNumber !== orderNumber) {
                return jsonResponse({ error: 'Order reference does not match.' }, 400, corsHeaders);
            }
            if (typeof amountDue !== 'number' || !Number.isFinite(amountDue) || amountDue <= 0) {
                return jsonResponse({ error: 'The atelier has not added an amount due yet.' }, 409, corsHeaders);
            }
            if (!/^[A-Z]{3}$/.test(currency)) {
                return jsonResponse({ error: 'The order has an invalid currency code.' }, 400, corsHeaders);
            }
            if (order.paymentStatus === 'Paid' || order.status === 'Paid') {
                return jsonResponse({ error: 'This order is already marked as paid.' }, 409, corsHeaders);
            }
            if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return jsonResponse({ error: 'A valid customer email is required for checkout.' }, 400, corsHeaders);
            }
            if (!env.PAYSTACK_SECRET_KEY) {
                return jsonResponse({ error: 'Payment service is not configured.' }, 503, corsHeaders);
            }

            const callbackUrl = new URL(env.PAYSTACK_CALLBACK_URL);
            callbackUrl.searchParams.set('order', orderNumber);
            const reference = `REMAG-${crypto.randomUUID()}`;
            const fractionDigits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
            const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    amount: Math.round(amountDue * (10 ** fractionDigits)),
                    currency,
                    reference,
                    callback_url: callbackUrl.toString(),
                    metadata: { orderId, orderNumber }
                })
            });
            const checkout = await paystackResponse.json();
            if (!paystackResponse.ok || !checkout.status || !checkout.data?.authorization_url) {
                console.error('Paystack initialization failed:', checkout.message || paystackResponse.status);
                return jsonResponse({ error: 'Paystack could not start checkout. Please try again.' }, 502, corsHeaders);
            }

            return jsonResponse({ authorizationUrl: checkout.data.authorization_url }, 200, corsHeaders);
        } catch (error) {
            console.error('Payment initialization failed:', error);
            return jsonResponse({ error: 'We could not start payment. Please try again.' }, 500, corsHeaders);
        }
    }
};