# CivicSnap

CivicSnap is a civic engagement web application that empowers citizens to report local infrastructure issues and track their resolution. By simply uploading a photo, the platform automatically extracts geographic data, routes the complaint to the correct municipal ward, and allows the community to track and upvote issues.

## 🌟 Key Features

* **Automated Location Tracking**: Extracts GPS metadata (Exif) directly from uploaded images to accurately map the issue.
* **Smart Spatial Routing**: Utilizes PostGIS spatial queries (`ST_Contains`) to automatically route complaints to the appropriate administrative ward based on coordinates.
* **Super Admin Geospatial Map**: Advanced map interface using Leaflet entirely decoupled from paid APIs like Google Maps. Super Admins can dynamically draw spatial polygons right on the map to rapidly create new jurisdiction wards!
* **Scalable Admin Rights**: A true Many-To-Many (N:M) relational architecture allows single Admins to manage a massive array of individual wards, securely configured by the interactive checklist portal.
* **Duplicate Detection**: Prevents redundant reporting by checking for similar active issues within a 20-meter radius (`ST_DWithin`) before accepting new submissions.
* **Civic Media Feed**: A community feed where users can view ongoing complaints in their area and upvote them to raise priority.

## 🛠 Architecture & Tech Stack

### Frontend Overview
The frontend is built as a Single Page Application (SPA) using React 19 and Vite. It handles user authentication, media processing, and provides tailored dashboards for different user roles.

* **Core Framework:** React 19, React Router DOM
* **Styling & UI:** Tailwind CSS v4, Framer Motion for animations, Lucide React for icons.
* **Map Engine:** Leaflet + React-Leaflet
* **Primary Routes:**
  * `/` - Landing Page
  * `/dashboard` - User's personal overview (Protected)
  * `/report` - Issue submission portal (Protected)
  * `/civic-media` - Public community feed
  * `/admin/issues` - Dedicated administrative management view
  * `/superadmin` - System Core protected by master credentials to govern boundaries and roles

### Backend Overview
* **Framework:** Python Flask REST API.
* **Database & Storage:** Supabase (PostgreSQL with PostGIS extension for geospatial queries, and Supabase Storage for images).

---

## 📂 Project Structure

```text
CivicSnap/
├── backend/
│   ├── app.py                # Main Flask application and REST API endpoints
│   ├── helper.py             # Utility functions (GPS extraction, image compression, DB connection)
│   ├── init.sql              # Database schema, PostGIS configuration, and initial setup
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── public/               # Static assets (icons, web manifest, logos)
│   ├── src/
│   │   ├── components/       # Reusable React components (Layout, ProtectedRoute, Modals)
│   │   ├── context/          # React Context providers (AuthContext)
│   │   ├── lib/              # Utility classes and Supabase client initialization (supabase.ts, utils.ts)
│   │   ├── pages/            # Page-level components corresponding to routes (Home, Dashboard, SuperAdmin etc.)
│   │   ├── App.tsx           # Main application routing definition
│   │   ├── main.tsx          # React application entry point
│   │   └── index.css         # Global Tailwind styles
│   ├── package.json          # Node.js dependencies and run scripts
│   └── vite.config.ts        # Vite build configuration
└── README.md                 # This documentation file
```

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* Python 3.8+
* A Supabase Project (with PostGIS enabled)

### Environment Setup

#### 1. Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Create and activate a virtual environment.
3. Install dependencies: `pip install -r requirements.txt`
4. Create a `.env` file in the `backend` directory and add the following variables:
   ```env
   # Database Connection
   DB_HOST=your_database_host
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASS=your_database_password
   DB_PORT=5432

   # Supabase Credentials
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_service_role_key
   SUPABASE_BUCKET=your_storage_bucket_name
   ```
5. Run the Flask server: `python app.py` (Server will start on port 5000).

#### 2. Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install the necessary packages: `npm install`
3. Create a `.env` file for your Supabase frontend credentials and API base URL:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   # Backend API URL (normalized automatically: supports http://localhost:5000 or http://localhost:5000/api/v1)
   VITE_API_URL=http://localhost:5000
   ```
4. Start the Vite development server: `npm run dev` (The frontend will be available at `http://localhost:5173`).

---

## 📡 API Endpoints Summary

The Flask backend exposes several REST endpoints under `/api/v1/`:

* **Public & Citizen Routes**
  * **`GET /`** - Health check
  * **`POST /report`** - Submit a new issue (requires image with GPS metadata)
  * **`GET /complaints/user/<phone_number>`** - Fetch complaints reported by a specific user
  * **`GET /complaints/ward?lat=&lon=`** - Fetch complaints surrounding a specific geographic coordinate
  * **`POST /complaints/<issue_id>/vote`** - Increment community upvotes for a specific issue
  * **`GET /wards`** - Fetch the list of available wards and its GeoJSON data

* **Admin Routes (Requires Authorization)**
  * **`GET /admin/complaints`** - Admin route to view complaints (filters by admin's allocated ward array)
  * **`PATCH /admin/complaints/<issue_id>/status`** - Admin route to update issue statuses

* **Super Admin Routes (Infrastructure & Authority Management)**
  * **`POST /wards`** - Draw/create new PostGIS geometries that prohibit overlap
  * **`DELETE /wards/<ward_id>`** - Erase an administrative boundary securely
  * **`GET /admin/users`** - Secure fetch of authenticated database profiles leveraging `auth.users`
  * **`POST /wards/<ward_id>/admin`** - Synchronization payload to allocate and revoke `admin` privileges in bulk