# Settings API Documentation

## Overview
All settings images (logo, login image, hero sliders) now use **integer IDs** stored in a separate `settings_images` table. This allows proper management with add/update/delete operations.

## Database Structure

### Settings Table
- `id` (INTEGER, Primary Key)
- `appLogoLightId` (INTEGER, Foreign Key → settings_images.id)
- `appLogoDarkId` (INTEGER, Foreign Key → settings_images.id)
- `loginDialogImageId` (INTEGER, Foreign Key → settings_images.id)

### Settings Images Table
- `id` (INTEGER, Primary Key, Auto Increment)
- `imageType` (ENUM: 'hero_slider', 'logo_light', 'logo_dark', 'login_dialog')
- `imagePath` (STRING) - filename only
- `fileType` (ENUM: 'image', 'video')
- `ordering` (INTEGER) - for hero sliders ordering

---

## API Endpoints

### Base URL: `/api/settings`

---

## 🔹 GET APIs (Public)

### 1. Get All Settings
```http
GET /api/settings
```

**Response:**
```json
{
  "success": false,
  "message": "Settings fetched successfully",
  "data": {
    "id": 1,
    "appLogoLight": {
      "id": 5,
      "imagePath": "logo-light-1234567890.png",
      "url": "uploads/static-images/logo-light-1234567890.png",
      "fileType": "image"
    },
    "appLogoDark": {
      "id": 6,
      "imagePath": "logo-dark-1234567891.png",
      "url": "uploads/static-images/logo-dark-1234567891.png",
      "fileType": "image"
    },
    "loginDialogImage": {
      "id": 7,
      "imagePath": "login-dialog-1234567892.jpg",
      "url": "uploads/static-images/login-dialog-1234567892.jpg",
      "fileType": "image"
    },
    "heroSliders": [
      {
        "id": 1,
        "imagePath": "hero-slider-1234567893.jpg",
        "url": "uploads/static-images/hero-slider-1234567893.jpg",
        "fileType": "image",
        "ordering": 0
      },
      {
        "id": 2,
        "imagePath": "hero-slider-1234567894.mp4",
        "url": "uploads/static-images/hero-slider-1234567894.mp4",
        "fileType": "video",
        "ordering": 1
      }
    ],
    "createdAt": "2025-12-12T00:00:00.000Z",
    "updatedAt": "2025-12-12T00:00:00.000Z"
  }
}
```

---

### 2. Get Logo by Mode
```http
GET /api/settings/logo/:mode
```

**Parameters:**
- `mode` (path): `light` or `dark`

**Example:**
```http
GET /api/settings/logo/light
```

**Response:**
```json
{
  "success": false,
  "message": "Logo fetched successfully",
  "data": {
    "logo": {
      "id": 5,
      "imagePath": "logo-light-1234567890.png",
      "url": "uploads/static-images/logo-light-1234567890.png",
      "fileType": "image"
    }
  }
}
```

---

### 3. Get Login Image
```http
GET /api/settings/login-image
```

**Response:**
```json
{
  "success": false,
  "message": "Login image fetched successfully",
  "data": {
    "image": {
      "id": 7,
      "imagePath": "login-dialog-1234567892.jpg",
      "url": "uploads/static-images/login-dialog-1234567892.jpg",
      "fileType": "image"
    }
  }
}
```

---

### 4. Get Hero Sliders
```http
GET /api/settings/hero-sliders
```

**Response:**
```json
{
  "success": false,
  "message": "Hero sliders fetched successfully",
  "data": {
    "sliders": [
      {
        "id": 1,
        "imagePath": "hero-slider-1234567893.jpg",
        "url": "uploads/static-images/hero-slider-1234567893.jpg",
        "fileType": "image",
        "ordering": 0
      },
      {
        "id": 2,
        "imagePath": "hero-slider-1234567894.mp4",
        "url": "uploads/static-images/hero-slider-1234567894.mp4",
        "fileType": "video",
        "ordering": 1
      }
    ],
    "total": 2
  }
}
```

---

## 🔹 POST APIs (Admin Only - Requires Bearer Token)

### 1. Upload Logo (Replaces Existing)
```http
POST /api/settings/logo
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Form Data:**
- `logo` (file): Image file
- `mode` (string): `light` or `dark`

**Example (JavaScript/Fetch):**
```javascript
const formData = new FormData();
formData.append('logo', fileInput.files[0]);
formData.append('mode', 'light');

const response = await fetch('/api/settings/logo', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Response:**
```json
{
  "success": false,
  "message": "Logo uploaded successfully",
  "data": {
    "id": 5,
    "mode": "light",
    "imagePath": "logo-light-1234567890.png",
    "url": "uploads/static-images/logo-light-1234567890.png"
  }
}
```

**Note:** This **replaces** the existing logo. Old logo file is deleted from disk.

---

### 2. Upload Login Image (Replaces Existing)
```http
POST /api/settings/login-image
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Form Data:**
- `image` (file): Image file

**Example (JavaScript/Fetch):**
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);

const response = await fetch('/api/settings/login-image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Response:**
```json
{
  "success": false,
  "message": "Login dialog image uploaded successfully",
  "data": {
    "id": 7,
    "imagePath": "login-dialog-1234567892.jpg",
    "url": "uploads/static-images/login-dialog-1234567892.jpg"
  }
}
```

**Note:** This **replaces** the existing login image. Old image file is deleted from disk.

---

### 3. Upload Hero Sliders (Adds to Existing)
```http
POST /api/settings/hero-sliders
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Form Data:**
- `files[]` (file[]): Array of image/video files (max 10 files)

**Example (JavaScript/Fetch):**
```javascript
const formData = new FormData();
// Add multiple files
for (let i = 0; i < fileInput.files.length; i++) {
  formData.append('files', fileInput.files[i]);
}

const response = await fetch('/api/settings/hero-sliders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Response:**
```json
{
  "success": false,
  "message": "Hero slider files uploaded successfully",
  "data": {
    "uploadedFiles": [
      {
        "id": 1,
        "imagePath": "hero-slider-1234567893.jpg",
        "url": "uploads/static-images/hero-slider-1234567893.jpg",
        "fileType": "image"
      },
      {
        "id": 2,
        "imagePath": "hero-slider-1234567894.mp4",
        "url": "uploads/static-images/hero-slider-1234567894.mp4",
        "fileType": "video"
      }
    ],
    "totalUploaded": 2
  }
}
```

**Note:** This **adds** new sliders to existing ones. Does not replace existing sliders.

---

## 🔹 DELETE APIs (Admin Only - Requires Bearer Token)

### 1. Delete Hero Slider by ID
```http
DELETE /api/settings/hero-sliders/:id
Authorization: Bearer {token}
```

**Parameters:**
- `id` (path, integer): Hero slider image ID

**Example:**
```http
DELETE /api/settings/hero-sliders/1
```

**Example (JavaScript/Fetch):**
```javascript
const response = await fetch('/api/settings/hero-sliders/1', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response:**
```json
{
  "success": false,
  "message": "Hero slider deleted successfully",
  "data": {
    "deletedId": 1,
    "deletedFile": "hero-slider-1234567893.jpg"
  }
}
```

---

## Frontend Integration Examples

### React/Next.js Example

```typescript
// Types
interface SettingsImage {
  id: number;
  imagePath: string;
  url: string;
  fileType: 'image' | 'video';
  ordering?: number;
}

interface Settings {
  id: number;
  appLogoLight: SettingsImage | null;
  appLogoDark: SettingsImage | null;
  loginDialogImage: SettingsImage | null;
  heroSliders: SettingsImage[];
}

// Get all settings
async function getSettings(): Promise<Settings> {
  const response = await fetch('/api/settings');
  const result = await response.json();
  return result.data;
}

// Upload logo
async function uploadLogo(file: File, mode: 'light' | 'dark'): Promise<SettingsImage> {
  const formData = new FormData();
  formData.append('logo', file);
  formData.append('mode', mode);

  const response = await fetch('/api/settings/logo', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  const result = await response.json();
  return result.data;
}

// Upload login image
async function uploadLoginImage(file: File): Promise<SettingsImage> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/settings/login-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  const result = await response.json();
  return result.data;
}

// Upload hero sliders (multiple files)
async function uploadHeroSliders(files: File[]): Promise<SettingsImage[]> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await fetch('/api/settings/hero-sliders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  const result = await response.json();
  return result.data.uploadedFiles;
}

// Delete hero slider
async function deleteHeroSlider(id: number): Promise<void> {
  const response = await fetch(`/api/settings/hero-sliders/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  });

  const result = await response.json();
  if (result.success) {
    throw new Error(result.message);
  }
}
```

### Vue.js Example

```typescript
// composables/useSettings.ts
import { ref } from 'vue';

export function useSettings() {
  const settings = ref<Settings | null>(null);
  const loading = ref(false);

  const fetchSettings = async () => {
    loading.value = true;
    try {
      const response = await fetch('/api/settings');
      const result = await response.json();
      settings.value = result.data;
    } finally {
      loading.value = false;
    }
  };

  const uploadLogo = async (file: File, mode: 'light' | 'dark') => {
    const formData = new FormData();
    formData.append('logo', file);
    formData.append('mode', mode);

    const response = await fetch('/api/settings/logo', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });

    const result = await response.json();
    await fetchSettings(); // Refresh settings
    return result.data;
  };

  const deleteHeroSlider = async (id: number) => {
    await fetch(`/api/settings/hero-sliders/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    await fetchSettings(); // Refresh settings
  };

  return {
    settings,
    loading,
    fetchSettings,
    uploadLogo,
    deleteHeroSlider
  };
}
```

---

## Key Points

1. **All images use integer IDs** - Easy to reference and delete
2. **Logo & Login Image** - POST replaces existing (update operation)
3. **Hero Sliders** - POST adds new ones, DELETE removes by ID
4. **File URLs** - Always use `uploads/static-images/{imagePath}` format
5. **Response Format** - All APIs return `{ success, message, data }` structure
6. **Authentication** - All POST/DELETE endpoints require Bearer token (Admin only)

---

## Migration Notes

If you have existing data in the old format:
1. Old `heroSliders` JSON array will need migration
2. Old `appLogoLight`, `appLogoDark`, `loginDialogImage` strings will need migration
3. Contact backend team for migration script if needed

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": true,
  "message": "Error message here",
  "data": null
}
```

Common HTTP Status Codes:
- `200` - Success
- `401` - Unauthorized (missing/invalid token)
- `404` - Resource not found
- `400` - Bad request (invalid file type, etc.)

