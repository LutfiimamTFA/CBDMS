// This service account is used by Firebase Admin SDK on the server-side.
// It is NOT a public configuration and must be kept secure.

// IMPORTANT: In a real production environment, you would load this from
// a secure source like Google Secret Manager or environment variables.
// Do not commit the actual service account key to your repository.

// For demonstration purposes in Firebase Studio, we use a placeholder.
// The build system will inject the correct service account key during deployment.

export const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
  "private_key_id": "your-private-key-id",
  "private_key": "your-private-key",
  "client_email": "your-client-email",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "your-client-x509-cert-url"
};
