// This service account is used by Firebase Admin SDK on the server-side.
// It is NOT a public configuration and must be kept secure.

// The service account key is securely injected from an environment variable.
// In Firebase Studio, this is handled automatically.
// For local development outside of Studio, you would set the
// FIREBASE_SERVICE_ACCOUNT_KEY environment variable.

let serviceAccountValue;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccountValue = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    // Provide a placeholder for when the env var is not set.
    // This prevents build errors but will fail at runtime if actually used.
    serviceAccountValue = {
      type: "service_account",
      project_id: "your-project-id",
      private_key_id: "your-private-key-id",
      private_key: "your-private-key",
      client_email: "your-client-email",
      client_id: "your-client-id",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "your-client-x509-cert-url"
    };
  }
} catch (e) {
  console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
  // Fallback to placeholder if JSON parsing fails
   serviceAccountValue = {
      type: "service_account",
      project_id: "your-project-id",
      private_key_id: "your-private-key-id",
      private_key: "your-private-key",
      client_email: "your-client-email",
      client_id: "your-client-id",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "your-client-x509-cert-url"
    };
}


export const serviceAccount = serviceAccountValue;
