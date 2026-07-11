# performa-backend

Express.js + PostgreSQL backend for Performa: proforma invoice creation with
JWT authentication and role-based access control (admin / manager / user).

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and JWT secrets
npm run migrate         # applies SQL migrations in src/db/migrations
npm run dev              # http://localhost:3000
```

Local Postgres via Docker:

```bash
docker run -d --name performa-postgres \
  -e POSTGRES_USER=performa -e POSTGRES_PASSWORD=performa_dev_pw -e POSTGRES_DB=performa \
  -p 5434:5432 postgres:16-alpine
```

## Roles

- `user` — can create/view/edit/delete their own proformas; cannot approve/reject them.
- `manager` — can view/manage all proformas and approve/reject any proforma.
- `admin` — everything a manager can do, plus user management (create users,
  change roles, deactivate/reactivate accounts).

New registrations via `POST /api/auth/register` are always created as `user`.
Promote the first admin manually:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

From there, that admin can create/promote other users via the `/api/users` endpoints.

## API

### Auth (`/api/auth`)
- `POST /register` — { name, email, password }
- `POST /login` — { email, password } → { user, accessToken, refreshToken }
- `POST /refresh` — { refreshToken } → rotates and returns a new token pair
- `POST /logout` — { refreshToken } → revokes it
- `GET /me` — current user (requires `Authorization: Bearer <accessToken>`)

### Users (`/api/users`, admin only)
- `GET /` — list users
- `POST /` — create a user with a specific role
- `GET /:id`
- `PATCH /:id/role` — { role }
- `POST /:id/deactivate`
- `POST /:id/reactivate`

### Proformas (`/api/proformas`, authenticated)
- `POST /` — { title, clientName, clientEmail?, taxRate, items: [{description, quantity, unitPrice}], ... }
- `GET /` — own proformas for `user`; all (optionally `?ownerId=`, `?status=`) for `manager`/`admin`
- `GET /:id`
- `PUT /:id`
- `PATCH /:id/status` — { status }; `approved`/`rejected` require `manager` or `admin`
- `DELETE /:id`

### Health
- `GET /api/health` — checks DB connectivity
