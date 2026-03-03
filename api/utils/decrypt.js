// For now, just pass through - no decryption
function decryptCipherResponse(response, key) {
  return null; // Disabled for debugging
}

function cleanHeaders(headers) {
  return headers || {};
}

function cleanUrl(url) {
  return url || '';
}

module.exports = {
  decryptCipherResponse,
  cleanHeaders,
  cleanUrl,
  CIPHER_KEY: "K9vT2mQxL8fWcD3pRZyU+Sa7nB1/M4tHgC6JkPwXe5qOVFbE2rYnLsZdVuA0GhT9"
};
