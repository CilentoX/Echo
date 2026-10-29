# Appwrite Database Collection: `user_profiles`

## Visão Geral

Collection para armazenar perfis globais de usuários (avatar, banner, bio, links) no Appwrite Database. Serve como fonte de verdade para dados que não existem no Matrix (banner global, bio, links sociais).

## Configuração no Console Appwrite

### Database
- **Database ID**: `echo-db` (configurável via `VITE_APPWRITE_DATABASE_ID`)
- **Collection ID**: `user_profiles` (configurável via `VITE_APPWRITE_PROFILES_COLLECTION_ID`)

### Atributos

| Atributo | Tipo | Obrigatório | Único | Descrição |
|----------|------|-------------|-------|-----------|
| `userId` | String | ✅ | ✅ | MXID do usuário (ex: `@user:echo.litteris.online`). Usado como document ID. |
| `avatarUrl` | String | ❌ | ❌ | URL do avatar no Appwrite Storage (HTTPS CDN) |
| `bannerUrl` | String | ❌ | ❌ | URL do banner no Appwrite Storage (HTTPS CDN) |
| `bio` | String | ❌ | ❌ | Bio/descrição do usuário (max 500 chars) |
| `links` | JSON | ❌ | ❌ | Array de links sociais: `[{ "label": "GitHub", "url": "https://github.com/user" }]` |

### Índices
- Índice único em `userId` (já garantido pelo document ID)

### Permissões (Appwrite Console > Collection > Settings > Permissions)

#### Read
- **Any** (público) - para que outros usuários possam ver o perfil
- Ou **Users** com role `member` se quiser restringir

#### Write (Create/Update/Delete)
- **Users** (apenas o próprio usuário pode editar seu perfil)
- Regra: `userId == request.userId`

### Exemplo de Documento

```json
{
  "$id": "@lucas:echo.litteris.online",
  "userId": "@lucas:echo.litteris.online",
  "avatarUrl": "https://fra.cloud.appwrite.io/v1/storage/buckets/profile-images/files/abc123/view?project=6ad904ff0035aa68066c",
  "bannerUrl": "https://fra.cloud.appwrite.io/v1/storage/buckets/profile-images/files/def456/view?project=6ad904ff0035aa68066c",
  "bio": "Desenvolvedor full-stack apaixonado por Rust e React",
  "links": [
    { "label": "GitHub", "url": "https://github.com/lucas" },
    { "label": "LinkedIn", "url": "https://linkedin.com/in/lucas" }
  ],
  "$createdAt": "2026-10-28T12:00:00.000Z",
  "$updatedAt": "2026-10-28T12:00:00.000Z",
  "$permissions": [],
  "$collectionId": "user_profiles",
  "$databaseId": "echo-db"
}
```

---

## Integração no Código

### API (`lib/appwrite/profiles.ts`)

```typescript
// Busca perfil global
getGlobalProfile(userId: string): Promise<GlobalProfile | null>

// Cria/atualiza perfil (upsert por userId)
upsertGlobalProfile(input: GlobalProfileInput): Promise<GlobalProfile>

// Atualiza parcialmente
patchGlobalProfile(userId: string, patch: Partial<GlobalProfileInput>): Promise<GlobalProfile>

// Deleta perfil
deleteGlobalProfile(userId: string): Promise<void>
```

### Integração no MatrixService (`lib/matrix/api/profile.ts`)

```typescript
async getUserProfile(userId: string): Promise<UserProfile> {
  const res = await this.requireClient().getProfileInfo(userId);
  const global = await getGlobalProfile(userId); // Busca no Appwrite DB
  return {
    displayName: res.displayname ?? null,
    avatarUrl: res.avatar_url ?? null,
    bannerUrl: global?.bannerUrl ?? null,  // Banner vem do Appwrite DB
    bio: global?.bio ?? null,              // Bio vem do Appwrite DB
    role: null,                            // Roles são por guilda (Matrix power levels)
  };
}

async getGlobalProfile(userId: string): Promise<GlobalProfile | null> {
  return getGlobalProfile(userId);
}
```

### Uso no MemberDropdownContent

```typescript
const [fetched, global] = await Promise.all([
  matrixService.getUserProfile(userId),
  matrixService.getGlobalProfile(userId),
]);

const merged = global
  ? { ...fetched, bannerUrl: global.bannerUrl ?? fetched.bannerUrl, bio: global.bio ?? fetched.bio }
  : fetched;
```

---

## Variáveis de Ambiente

```env
VITE_APPWRITE_DATABASE_ID=echo-db
VITE_APPWRITE_PROFILES_COLLECTION_ID=user_profiles
```

---

## Checklist de Criação no Console

- [ ] Criar Database `echo-db`
- [ ] Criar Collection `user_profiles` no database
- [ ] Adicionar atributos: `userId` (String, required, unique), `avatarUrl` (String), `bannerUrl` (String), `bio` (String, size 500), `links` (JSON)
- [ ] Configurar permissões: Read = Any, Write = Users (userId == request.userId)
- [ ] Adicionar variáveis de ambiente no `.env` / Vercel / CI
- [ ] Testar: `getGlobalProfile("@user:echo.litteris.online")` retorna o documento