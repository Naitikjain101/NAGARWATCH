<div align="center">
<br/>
<img src="https://readme-typing-svg.demolab.com?font=Space+Mono&weight=700&size=48&duration=3000&pause=1000&color=FFFFFF&center=true&vCenter=true&width=800&height=90&lines=AREA+WATCH;SEE+YOUR+AREA.+CHANGE+YOUR+AREA." alt="AREAWATCH" />
<br/>

GEOSPATIAL INTELLIGENCE · CIVIC TECHNOLOGY · COMMUNITY SAFETY

<br/>
<img src="https://img.shields.io/badge/STATUS-ACTIVE-22C55E?style=flat-square&labelColor=101827" />
<img src="https://img.shields.io/badge/REACT-19-61DAFB?style=flat-square&logo=react&logoColor=white&labelColor=101827" />
<img src="https://img.shields.io/badge/PYTHON-FLASK-3776AB?style=flat-square&logo=python&logoColor=white&labelColor=101827" />
<img src="https://img.shields.io/badge/POSTGIS-ENABLED-4169E1?style=flat-square&logo=postgresql&logoColor=white&labelColor=101827" />
<img src="https://img.shields.io/badge/SUPABASE-POWERED-3FCF8E?style=flat-square&logo=supabase&logoColor=white&labelColor=101827" />

Your neighbourhood has a story. Areawatch helps make it heard.

<br/>

Overview  · 
Features  · 
Architecture  · 
Installation  · 
API

<br/>
</div>

⸻

<div align="center">

01 / THE PLATFORM

A better way to watch over your neighbourhood.

</div>

Areawatch is a geospatial civic intelligence platform that connects citizens, local communities and municipal authorities through location-aware issue reporting.

A photograph can reveal more than a problem. It can reveal where it happened, which municipal ward is responsible, and how nearby residents can contribute towards resolving it.

Areawatch brings this entire process into one connected platform — from the first report to administrative action and community engagement.

<br/>
<div align="center">

REPORT	LOCATE	CONNECT	RESOLVE
📸	📍	👥	✓
Capture issues	Map their location	Engage residents	Track progress

</div>

⸻

<div align="center">

02 / PLATFORM CAPABILITIES

Built around real-world problems.

Six capabilities. One connected civic ecosystem.

</div>

01 — Intelligent Issue Reporting

A photograph is the starting point.

Citizens can submit infrastructure complaints by uploading photographs. Areawatch extracts embedded GPS metadata using EXIF processing to identify the reported location.

* Automatic GPS metadata extraction
* Image processing and storage
* Geographic issue identification

02 — Geospatial Ward Intelligence

Every issue belongs somewhere.

Using PostgreSQL and PostGIS, Areawatch identifies the municipal ward associated with a complaint through spatial boundary queries.

* ST_Contains for ward identification
* Geographic boundary matching
* Automatic jurisdiction assignment

03 — Interactive Ward Management

Administrative boundaries, drawn directly on the map.

The Super Admin interface provides a dedicated geospatial environment for creating and managing municipal ward boundaries.

* Draw polygons using Leaflet
* Create new jurisdiction boundaries
* Prevent overlapping ward geometries
* Manage ward territories

04 — Flexible Administration

One administrator. Multiple jurisdictions.

Areawatch uses a many-to-many relational architecture for administrative assignments.

* Assign multiple wards to one administrator
* Allocate and revoke permissions
* Interactive ward assignment interface
* Ward-based administrative access

05 — Spatial Duplicate Detection

Reduce repetition. Improve reporting quality.

Before accepting a new complaint, the system checks for potentially similar active issues within a 20-metre geographic radius.

* PostGIS ST_DWithin
* 20-metre proximity checking
* Active complaint comparison

06 — Community Intelligence Feed

Local problems deserve local attention.

The Civic Media feed allows residents to discover ongoing complaints and contribute through community upvotes.

* Explore reported complaints
* Discover nearby issues
* Upvote existing reports
* Increase visibility of community concerns

⸻

<div align="center">

03 / THE WORKFLOW

From a photograph to civic action.

</div>
flowchart TD
    A["01 · Citizen captures an issue"] --> B["02 · Photo uploaded"]
    B --> C["03 · EXIF GPS extraction"]
    C --> D["04 · Geographic coordinates"]
    D --> E["05 · PostGIS ward detection"]
    E --> F["06 · Duplicate proximity check"]
    F --> G["07 · Complaint stored"]
    G --> H["08 · Community discovery & upvotes"]
    G --> I["09 · Assigned ward administrator"]
    I --> J["10 · Status management"]
    J --> K["11 · Resolution tracking"]
    style A fill:#14243B,stroke:#38BDF8,color:#FFFFFF
    style E fill:#14243B,stroke:#38BDF8,color:#FFFFFF
    style G fill:#14243B,stroke:#38BDF8,color:#FFFFFF
    style I fill:#14243B,stroke:#818CF8,color:#FFFFFF
    style K fill:#123D32,stroke:#34D399,color:#FFFFFF

⸻

<div align="center">

04 / GEOSPATIAL ENGINE

Location is more than a coordinate.

It is the intelligence behind the platform.

</div>

Areawatch uses PostGIS to connect reported incidents with real geographic boundaries.

Ward identification

When a complaint is submitted, its coordinates can be checked against existing ward polygons.

SELECT id, name
FROM wards
WHERE ST_Contains(
    boundary,
    ST_SetSRID(
        ST_MakePoint(longitude, latitude),
        4326
    )
);

Duplicate proximity checking

The platform uses geographic distance calculations to identify potentially redundant active complaints.

SELECT *
FROM complaints
WHERE ST_DWithin(
    location::geography,
    ST_SetSRID(
        ST_MakePoint(longitude, latitude),
        4326
    )::geography,
    20
);

Spatial precision: The duplicate detection radius is 20 metres.

These are illustrative SQL examples based on the documented functionality. Adapt table and column names to the actual database schema.

⸻

<div align="center">

05 / UNDER THE HOOD

A connected full-stack architecture.

</div>
flowchart TB
    subgraph FRONTEND["PRESENTATION LAYER"]
        A["Citizen Portal"]
        B["Admin Dashboard"]
        C["Super Admin Portal"]
        D["Leaflet Mapping"]
    end
    subgraph BACKEND["APPLICATION LAYER · FLASK"]
        E["Authentication"]
        F["Complaint Management"]
        G["EXIF Processing"]
        H["Spatial Routing"]
        I["Administration"]
    end
    subgraph INFRA["DATA & INFRASTRUCTURE"]
        J[("PostgreSQL")]
        K["PostGIS"]
        L["Supabase Auth"]
        M["Supabase Storage"]
    end
    A --> E
    B --> E
    C --> E
    D --> H
    E --> F
    F --> G
    F --> H
    F --> I
    F --> J
    H --> K
    E --> L
    G --> M

Technology stack

Layer	Technology
Frontend framework	React 19
Language	TypeScript
Build tool	Vite
Routing	React Router DOM
Styling	Tailwind CSS v4
Animation	Framer Motion
Icons	Lucide React
Mapping	Leaflet + React-Leaflet
Backend	Python + Flask
Database	PostgreSQL
Geospatial processing	PostGIS
Authentication	Supabase Auth
File storage	Supabase Storage
Image metadata	EXIF GPS extraction

⸻

<div align="center">

06 / PROJECT STRUCTURE

Inside the codebase.

</div>
Areawatch/
│
├── backend/
│   ├── app.py
│   ├── helper.py
│   ├── init.sql
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   │
│   ├── package.json
│   └── vite.config.ts
│
└── README.md

⸻

<div align="center">

07 / GETTING STARTED

Run Areawatch locally.

</div>

Requirements

* Node.js 18 or newer
* Python 3.8 or newer
* A Supabase project
* PostgreSQL with PostGIS enabled

<details>
<summary><b>01 — Clone the repository</b></summary>
git clone YOUR_REPOSITORY_URL
cd Areawatch
</details>
<details>
<summary><b>02 — Configure the backend</b></summary>
cd backend
python -m venv venv

Activate the environment.

macOS / Linux

source venv/bin/activate

Windows

venv\Scripts\activate

Install dependencies:

pip install -r requirements.txt

Create backend/.env:

DB_HOST=your_database_host
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASS=your_database_password
DB_PORT=5432
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET=your_storage_bucket_name

Start Flask:

python app.py

Backend:

http://localhost:5000

</details>
<details>
<summary><b>03 — Configure the frontend</b></summary>

Open a new terminal:

cd frontend
npm install

Create frontend/.env:

VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000

Start Vite:

npm run dev

Frontend:

http://localhost:5173

</details>

⸻

<div align="center">

08 / API REFERENCE

The platform interface.

</div>

Base API path:

/api/v1/
<details>
<summary><b>Citizen & Public Endpoints</b></summary>

Method	Endpoint	Purpose
GET	/	Backend health check
POST	/report	Submit a new issue
GET	/complaints/user/<phone_number>	Fetch user complaints
GET	/complaints/ward?lat=&lon=	Fetch geographically relevant complaints
POST	/complaints/<issue_id>/vote	Upvote a complaint
GET	/wards	Fetch ward boundaries and GeoJSON

</details>
<details>
<summary><b>Administrator Endpoints</b></summary>

Method	Endpoint	Purpose
GET	/admin/complaints	Fetch complaints from assigned wards
PATCH	/admin/complaints/<issue_id>/status	Update complaint status

</details>
<details>
<summary><b>Super Administrator Endpoints</b></summary>

Method	Endpoint	Purpose
POST	/wards	Create ward boundaries
DELETE	/wards/<ward_id>	Delete a ward
GET	/admin/users	Fetch authenticated user profiles
POST	/wards/<ward_id>/admin	Allocate or revoke admin assignments

</details>

Protected endpoints require appropriate authorization.

⸻

<div align="center">

09 / ACCESS CONTROL

Three roles. One ecosystem.

</div>

ROLE	ACCESS & RESPONSIBILITY
Citizen	Report issues, explore complaints and upvote community reports.
Administrator	Manage complaints within assigned municipal wards.
Super Administrator	Govern ward boundaries, user access and administrative assignments.

Areawatch’s many-to-many administrative architecture allows a single administrator to manage multiple wards.

Security: Service-role credentials must remain server-side. Never commit .env files or expose privileged credentials in frontend code.

⸻

<div align="center">
<br/>

THE VISION

Every neighbourhood deserves attention.

A pothole. A broken streetlight. An overflowing garbage point.

Small problems can have a big impact on everyday life.

Areawatch aims to make these problems visible, connect the people affected by them, and bring them closer to the authorities responsible for resolving them.

<br/>
<img src="https://readme-typing-svg.demolab.com?font=Space+Mono&weight=700&size=23&pause=1600&color=38BDF8&center=true&vCenter=true&width=700&height=45&lines=SEE+YOUR+AREA.;UNDERSTAND+YOUR+AREA.;IMPROVE+YOUR+AREA." alt="Areawatch closing animation" />

AREAWATCH

Geospatial Intelligence for Better Communities.

<br/>

⭐ If you find this project interesting, consider giving the repository a star.

<br/>
</div>
