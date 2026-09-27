# EduMate API Contract

All APIs return a stable JSON envelope.

```json
{
  "success": true,
  "message": "Human readable result",
  "data": {},
  "metadata": {},
  "pagination": null,
  "errors": null
}
```

Error responses keep the same shape.

```json
{
  "success": false,
  "message": "Validation failed.",
  "data": null,
  "errors": ["Specific issue"]
}
```

## Current Auth Endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/profile`
- `PATCH /api/v1/auth/change-password`
- `POST /api/v1/auth/forgot-password`

Successful login and registration return the JWT in `metadata.accessToken`.

## Current User Endpoints

- `PUT /api/v1/users/:userId/avatar`

The avatar endpoint requires `Authorization: Bearer <token>` and only allows a user to update their own avatar unless the authenticated user is an admin or super admin.

## Current Chat Endpoints

- `POST /api/v1/chat/ask`

Request:

```json
{
  "question": "What is the admission process?",
  "conversationId": "optional_existing_chat_id"
}
```

Institutional questions require trusted context. If EduMate cannot verify the answer from configured institutional or trusted sources, the API returns a transparent low-confidence response instead of inventing facts.

## Current Document Endpoints

- `GET /api/v1/documents`
- `POST /api/v1/documents`
- `DELETE /api/v1/documents/:documentId`

Document upload uses multipart form data with a `document` file field. Teacher, faculty, admin, and super admin users can upload. Only admin and super admin users can delete documents.

## Current Admin Endpoints

- `GET /api/v1/auth/admin/status`
- `POST /api/v1/auth/admin/bootstrap`
- `POST /api/v1/auth/admin/login`
- `PUT /api/v1/admin/settings/api-keys`

Admin bootstrap creates the first super admin only when no admin exists. Provider API keys are admin-protected settings and are used only when environment variables are absent.
