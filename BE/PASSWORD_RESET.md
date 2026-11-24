# Password reset API

Apply `migrations/20261026_password_reset_tokens.sql` and `migrations/20261103_normalize_user_emails.sql` to the Supabase database before enabling these endpoints. The email migration stops with an error if case-insensitive duplicates exist; resolve those addresses before rerunning it.

Configure `SMTP_USER` and `SMTP_PASS` for email delivery. `FRONTEND_URL` defaults to `http://localhost:3000` and is also the only browser origin allowed by the backend CORS policy; set it to the deployed frontend origin in production. The reset page is expected at `/reset-password`. The current frontend does not yet include that page, so use the API steps below to complete a Postman test. Set `PASSWORD_RESET_URL` to override the full reset page URL.

Gemini-backed API routes require `GEMINI_API_KEY` (or `GOOGLE_GEMINI_API_KEY`). `GEMINI_MODEL` optionally selects the model and defaults to `gemini-2.5-flash`. These routes require an authenticated user.

## Endpoints

- `POST /api/auth/forgot-password` with `{ "email": "user@example.com" }` requests a reset link. The response message is intentionally the same whether or not the email is registered.
- `POST /api/auth/reset-password` with `{ "token": "...", "newPassword": "..." }` resets the password. Reset tokens expire after 60 minutes and are single-use.
- `PATCH /api/auth/change-password` requires authentication and `{ "currentPassword": "...", "newPassword": "..." }`.

Passwords must contain at least 8 characters and no more than 72 UTF-8 bytes. Reset links expire after 30 minutes by default; `system_settings.password_reset_link_lifetime` can override the lifetime in minutes. Apply the SQL migrations before requests so token storage and normalized email uniqueness are available.

## Testing with Postman

Run the backend with `npm run dev` so `NODE_ENV=development` is set automatically. Use an email address belonging to an existing user:

1. Send `POST http://localhost:9999/api/auth/forgot-password` with **Body → raw → JSON**:

   ```json
   {
     "email": "user@example.com"
   }
   ```

2. The response is `200 OK` with the generic message above. In development, it also contains `resetToken` when that email belongs to a user. Copy that value; do not expect a token for an unknown email.
3. Send `POST http://localhost:9999/api/auth/reset-password` with:

   ```json
   {
     "token": "paste-resetToken-here",
     "newPassword": "newpass123"
   }
   ```

4. Expect `200 OK` and `"message": "Password reset successfully"`. Then try logging in with the new password. The token can only be used once.

To test email delivery instead, configure SMTP and use a non-development environment. The reset link will be delivered to the account email; the API still returns the same generic message.
