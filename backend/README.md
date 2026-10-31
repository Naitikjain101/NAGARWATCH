# CivicSnap Backend API

CivicSnap is a smart, location-aware civic issue reporting platform. This repository contains the Python Flask REST API that powers the backend. It handles image uploads, forensic GPS metadata extraction, spatial routing using PostGIS, duplicate detection, and role-based access control via Supabase.

## ✨ Key Features

* **Forensic Verification:** Extracts EXIF GPS metadata from uploaded images to ensure complaints are reported from the actual location, preventing fake uploads.
* **Spatial Routing (PostGIS):** Automatically maps the GPS coordinates of a reported issue to its specific city ward using `ST_Contains` polygon logic.
* **Smart Duplicate Detection:** Uses `ST_DWithin` to detect if an issue of the same category has already been reported within a 20-meter radius.
* **Upvoting System:** Instead of rejecting duplicate reports, allows users to upvote existing nearby issues to help admins prioritize severe problems.
* **Image Optimization:** Automatically compresses uploaded evidence photos using Pillow before storing them in Supabase Storage to save bandwidth.
* **Role-Based Access Control (RBAC):** Secure admin and citizen roles powered by Supabase Auth metadata and PostgreSQL triggers, ensuring admins only see issues for their allocated wards.

## 🛠️ Tech Stack

* **Framework:** Python 3 + Flask
* **Database:** PostgreSQL with PostGIS extension
* **BaaS / Storage:** Supabase (Auth, Storage Buckets, Database)
* **Image Processing:** Pillow (PIL)
* **Deployment Ready:** Configured for Gunicorn

## 📁 Project Structure

```text
.
├── app.py                   # Main application routing and API endpoints
├── helper.py                # Utilities: DB connection, GPS extraction, Image compression
├── init.sql                 # PostgreSQL/PostGIS schema, tables, and Auth triggers
├── requirements.txt         # Python dependencies
├── .gitignore               # Git ignore rules for the backend
├── .env                     # Environment variables (DB credentials, Supabase keys) - Not in version control
└── uploads/                 # Temporary staging folder for image forensics (auto-generated)

```

## 🚀 Getting Started

### Prerequisites

* Python 3.8 or higher
* A [Supabase](https://supabase.com) account and project
* PostgreSQL with PostGIS enabled

### 1. Installation

Clone the repository and install the required dependencies:

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows: venv\Scripts\activate
# On macOS/Linux: source venv/bin/activate

# Install requirements
pip install -r requirements.txt

```

### 2. Environment Variables

Create a `.env` file in the root directory and add your Supabase and Database credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_BUCKET=complaints

DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=postgres
DB_USER=your_db_user
DB_PASS=your_db_password

```

### 3. Database Setup

Run the provided SQL script to set up the schema:

1. Open your Supabase Dashboard.
2. Navigate to the SQL Editor.
3. Copy the contents of `init.sql` and run it. This will:
* Enable the PostGIS extension.
* Create the `wards`, `complaints`, and `profiles` tables.
* Set up the public storage bucket for images.
* Create the Postgres trigger for handling user roles on signup.



### 4. Running the Server

Start the Flask development server:

```bash
python app.py

```

The API will be available at `http://localhost:5000`.

## 📡 API Endpoints

### Public / Citizen Routes

* `GET /` - Health check endpoint.
* `POST /api/v1/report` - Upload a new civic issue (Requires image with EXIF GPS data).
* `GET /api/v1/complaints/user/<phone_number>` - Fetch all reports made by a specific user.
* `GET /api/v1/complaints/ward?lat=<lat>&lon=<lon>` - Fetch all local issues based on the user's current GPS location.
* `POST /api/v1/complaints/<issue_id>/vote` - Upvote an existing duplicate issue.
* `GET /api/v1/wards` - Fetch a list of all registered wards.

### Admin Routes

* `GET /api/v1/admin/complaints?user_id=<uuid>` - Fetch issues assigned to the admin's specific ward.
* `PATCH /api/v1/admin/complaints/<issue_id>/status` - Update the status of a complaint (`pending`, `in_progress`, `resolved`, `rejected`).

## 📄 License

This project is licensed under the MIT License - see the LICENSE.txt file for details.