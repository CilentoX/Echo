export const APPWRITE_CONFIG = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1",
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID ?? "6ad904ff0035aa68066c",
  apiKey: import.meta.env.VITE_APPWRITE_API_KEY,
  bucketId: import.meta.env.VITE_APPWRITE_BUCKET_ID ?? "profile-images",
};
