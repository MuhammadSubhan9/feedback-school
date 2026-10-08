declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_EMAILS?: string;
    FEEDBACK_SECRET?: string;
    SITE_ORIGIN?: string;
    OWNER_SETUP_KEY?: string;
    PASSWORD_PEPPER?: string;
  }
}
