'use strict';
/* A small Razorpay client: create an order, look up a payment, capture it.
   Uses Razorpay's REST API directly (https://razorpay.com/docs/api/). */
function makeRazorpay({ keyId, keySecret, base = 'https://api.razorpay.com/v1', fetchImpl = fetch }) {
  if (!keyId || !keySecret) throw new Error('Razorpay keys are not set');
  const auth = 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64');
  async function call(method, path, body) {
    const res = await fetchImpl(base + path, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error('Razorpay ' + res.status + ': ' + ((json.error && json.error.description) || 'request failed'));
      e.status = res.status;
      throw e;
    }
    return json;
  }
  return {
    keyId,
    createOrder: b => call('POST', '/orders', b),
    fetchPayment: id => call('GET', '/payments/' + encodeURIComponent(id)),
    capture: (id, amount, currency) => call('POST', '/payments/' + encodeURIComponent(id) + '/capture', { amount, currency })
  };
}
module.exports = { makeRazorpay };
