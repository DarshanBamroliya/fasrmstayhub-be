# Settings API - Simplified Documentation

## Overview
Simplified settings module with clean APIs. All images stored in `settings_images` table with structure: `id`, `imageType`, `imagePath`.

## Database Structure

### Settings Images Table
- `id` (INTEGER, Primary Key, Auto Increment)
- `imageType` (ENUM: 'logo', 'login_dialog', 'hero_slider')
- `imagePath` (STRING) - filename only
- `createdAt` (DATE)
- `updatedAt` (DATE)

---

## API Endpoints

### Base URL: `/api/settings`

---

## 🔹 GET APIs (Public)

### 1. Get Logo
```http
GET /api/settings/logo
```

**Response:**
```json
{
  "error": false,
  "msg": "Logo fetched successfully",
  "data": {
    "logo": {
      "id": 5,
      "imagePath": "logo-1234567890.png",
      "url": "uploads/static-images/logo-1234567890.png"
    }
  }
}
```

---

### 2. Get Login Image
```http
GET /api/settings/login-image
```

**Response:**
```json
{
  "error": false,
  "msg": "Login image fetched successfully",
  "data": {
    "image": {
      "id": 7,
      "imagePath": "login-dialog-1234567892.jpg",
      "url": "uploads/static-images/login-dialog-1234567892.jpg"
    }
  }
}
```

---

### 3. Get Hero Sliders
```http
GET /api/settings/hero-sliders
```

**Response:**
```json
{
  "error": false,
  "msg": "Hero sliders fetched successfully",
  "data": {
    "sliders": [
      {
        "id": 1,
        "imagePath": "hero-slider-1234567893.jpg",
        "url": "uploads/static-images/hero-slider-1234567893.jpg"
      },
      {
        "id": 2,
        "imagePath": "hero-slider-1234567894.mp4",
        "url": "uploads/static-images/hero-slider-1234567894.mp4"
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

**Example (JavaScript/Fetch):**
```javascript
const formData = new FormData();
formData.append('logo', fileInput.files[0]);

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
  "error": false,
  "msg": "Logo uploaded successfully",
  "data": {
    "id": 5,
    "imagePath": "logo-1234567890.png",
    "url": "uploads/static-images/logo-1234567890.png"
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
  "error": false,
  "msg": "Login dialog image uploaded successfully",
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
  "error": false,
  "msg": "Hero slider files uploaded successfully",
  "data": {
    "uploadedFiles": [
      {
        "id": 1,
        "imagePath": "hero-slider-1234567893.jpg",
        "url": "uploads/static-images/hero-slider-1234567893.jpg"
      },
      {
        "id": 2,
        "imagePath": "hero-slider-1234567894.mp4",
        "url": "uploads/static-images/hero-slider-1234567894.mp4"
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
  "error": false,
  "msg": "Hero slider deleted successfully",
  "data": {
    "deletedId": 1,
    "deletedFile": "hero-slider-1234567893.jpg"
  }
}
```

---

## Summary

### Logo
- **GET** `/api/settings/logo` - Get logo
- **POST** `/api/settings/logo` - Upload logo (replaces existing)

### Login Image
- **GET** `/api/settings/login-image` - Get login image
- **POST** `/api/settings/login-image` - Upload login image (replaces existing)

### Hero Sliders
- **GET** `/api/settings/hero-sliders` - Get all hero sliders
- **POST** `/api/settings/hero-sliders` - Upload hero sliders (adds to existing)
- **DELETE** `/api/settings/hero-sliders/:id` - Delete hero slider by ID

---

## Database Migration

Run this SQL to update the database:

```sql
-- Update ImageType enum
ALTER TABLE settings_images 
MODIFY COLUMN imageType ENUM('logo', 'login_dialog', 'hero_slider') NOT NULL;

-- Remove unused columns (if they exist)
ALTER TABLE settings_images 
DROP COLUMN IF EXISTS fileType,
DROP COLUMN IF EXISTS ordering;
```

---

## Frontend Integration Example

```typescript
// Types
interface SettingsImage {
  id: number;
  imagePath: string;
  url: string;
}

// Get logo
async function getLogo(): Promise<SettingsImage | null> {
  const response = await fetch('/api/settings/logo');
  const result = await response.json();
  return result.data.logo;
}

// Upload logo
async function uploadLogo(file: File): Promise<SettingsImage> {
  const formData = new FormData();
  formData.append('logo', file);

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

// Upload hero sliders
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
  if (result.error) {
    throw new Error(result.msg);
  }
}
```

