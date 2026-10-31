import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from supabase import create_client, Client
from helper import get_db_connection, extract_gps, compress_image
import datetime

app = Flask(__name__)

# --- ENABLE CORS ---
CORS(app)

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Staging folder for temporary storage during forensic checks
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------

# 1. Health Check Endpoint
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        "status": "Online",
        "version": "1.0",
        "message": "Complaint API Backend is running."
    }), 200

# 2. Main Upload Endpoint (Versioned and restricted to POST)
@app.route('/api/v1/report', methods=['POST'])
def report_issue():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    
    file = request.files['image']
    
    # Secure filename against directory traversal
    filename = secure_filename(file.filename)
    if not filename:
         # Fallback just in case filename is completely invalid
         file_extension = os.path.splitext(file.filename)[1]
         filename = f"upload{file_extension}"
         
    category = request.form.get('category', 'No category')
    desc = request.form.get('description', 'No description')
    phone = request.form.get('phone')
    force_new = request.form.get('force_new', 'false').lower() == 'true'
    
    temp_file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(temp_file_path)

    gps_data = extract_gps(temp_file_path)
    if not gps_data:
        os.remove(temp_file_path)
        return jsonify({"status": "Rejected", "reason": "Image lacks GPS metadata"}), 400
    
    lat, lon = gps_data
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        if not force_new:
            # Cast to geography to ensure 20 means 20 meters, not 20 degrees
            check_query = """
                SELECT id, category, description, status, image_url, created_at, phone_number, ward_id 
                FROM complaints 
                WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 20)
                AND status != 'resolved';
            """
            cur.execute(check_query, (lon, lat))
            data = cur.fetchall()
            
            duplicate_issue = None
            for issue in data:
                if issue[1] == category:
                    # Format datetime safely
                    db_date = issue[5]
                    iso_date = db_date.isoformat() + 'Z' if isinstance(db_date, datetime.datetime) else None
                    
                    duplicate_issue = {
                        "id": str(issue[0]),
                        "category": issue[1],
                        "description": issue[2],
                        "status": issue[3].lower() if issue[3] else 'pending',
                        "image_url": issue[4],
                        "created_at": iso_date,
                        "phone_number": issue[6],
                        "ward_id": issue[7],
                        "latitude": lat,
                        "longitude": lon
                    }
                    break

            if duplicate_issue:
                # Return the duplicate data to the frontend modal
                return jsonify({
                    "status": "Duplicate", 
                    "message": "This issue has already been reported nearby.",
                    "existing_issue": duplicate_issue
                }), 409

        # --- SPATIAL ROUTING ---
        routing_query = """
            SELECT id, name FROM wards 
            WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326));
        """
        cur.execute(routing_query, (lon, lat))
        ward = cur.fetchone()
        ward_id = ward[0] if ward else None
        ward_name = ward[1] if ward else "Unknown Area"

        # --- UPLOAD COMPRESSED IMAGE ---
        compression_success = compress_image(temp_file_path, quality=80)
        file_extension = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"

        with open(temp_file_path, 'rb') as f:
            supabase.storage.from_(SUPABASE_BUCKET).upload(
                path=unique_filename, file=f, file_options={"content-type": file.mimetype}
            )
        public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(unique_filename)

        # --- SAVE TO DATABASE ---
        insert_query = """
            INSERT INTO complaints (image_url, description, geom, ward_id, category, phone_number, upvotes)
            VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, 0)
            RETURNING id;
        """
        cur.execute(insert_query, (public_url, desc, lon, lat, ward_id, category, phone))
        new_id = cur.fetchone()[0]
        conn.commit()
        
        return jsonify({
            "status": "Success", 
            "complaint_id": new_id,
            "routed_to_ward": ward_name,
            "image_url": public_url
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Failed to process request: {str(e)}"}), 500

    finally:
        cur.close()
        conn.close()
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

# 3. Issue Request End point
@app.route('/api/v1/complaints/user/<string:phone_number>', methods=['GET'])
def get_user_complaints(phone_number):
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        query = """
            SELECT id, description, status, image_url, created_at, 
                   ST_Y(geom) as lat, ST_X(geom) as lon
            FROM complaints 
            WHERE phone_number = %s
            ORDER BY created_at DESC;
        """
        cur.execute(query, (phone_number,))
        records = cur.fetchall()

        complaints = []
        for row in records:
            # Handle the datetime to ISO string conversion safely
            db_date = row[4]
            if isinstance(db_date, datetime.datetime):
                # Convert to standard ISO format with 'Z' indicating UTC
                iso_date = db_date.isoformat()
                if not iso_date.endswith('Z') and not '+' in iso_date:
                    iso_date += 'Z'
            else:
                iso_date = None

            # Handle status casing (defaulting to 'pending' if null)
            raw_status = row[2]
            status_val = raw_status.lower() if raw_status else 'pending'

            # Build the exact dictionary the frontend expects
            complaints.append({
                "id": str(row[0]),
                "description": row[1],
                "status": status_val,
                "image_url": row[3],
                "created_at": iso_date,
                "latitude": row[5],
                "longitude": row[6]
            })
        print(complaints)

        # Return the raw array directly if your frontend maps over the root response
        return jsonify(complaints), 200

    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        cur.close()
        conn.close()
    
# 4. End point to fetch Issues around a location
@app.route('/api/v1/complaints/ward', methods=['GET'])
def get_complaints_by_location():
    # 1. Grab coordinates from the URL query string
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    if not lat or not lon:
        return jsonify({"error": "Latitude and longitude are required parameters"}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"error": "Invalid coordinates provided"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # --- STEP 1: Find which ward contains this location ---
        ward_query = """
            SELECT id, name FROM wards 
            WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326));
        """
        cur.execute(ward_query, (lon, lat))
        ward = cur.fetchone()

        # If the user is outside your defined city boundaries
        if not ward:
            return jsonify({
                "status": "Not Found",
                "message": "This location does not fall inside any registered ward.",
                "data": []
            }), 404

        ward_id, ward_name = ward[0], ward[1]

        # --- STEP 2: Fetch all complaints for this ward ---
        complaints_query = """
            SELECT id, category, description, status, image_url, created_at, 
                   ST_Y(geom) as lat, ST_X(geom) as lon 
            FROM complaints 
            WHERE ward_id = %s
            ORDER BY created_at DESC;
        """
        cur.execute(complaints_query, (ward_id,))
        records = cur.fetchall()

        complaints = []
        for row in records:
            # Handle standard ISO date formatting
            db_date = row[5]
            if isinstance(db_date, datetime.datetime):
                iso_date = db_date.isoformat()
                if not iso_date.endswith('Z') and not '+' in iso_date:
                    iso_date += 'Z'
            else:
                iso_date = None

            raw_status = row[3]
            status_val = raw_status.lower() if raw_status else 'pending'

            complaints.append({
                "id": str(row[0]),
                "category": row[1],
                "description": row[2],
                "status": status_val,
                "image_url": row[4],
                "created_at": iso_date,
                "latitude": row[6],
                "longitude": row[7]
            })

        # Return a rich payload including the identified ward context
        return jsonify({
            "status": "Success",
            "ward_id": ward_id,
            "ward_name": ward_name,
            "count": len(complaints),
            "data": complaints
        }), 200

    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        cur.close()
        conn.close()

# 5. ADMIN: Get complaints (Filtered by Ward)
@app.route('/api/v1/admin/complaints', methods=['GET'])
def get_all_complaints():
    admin_id = request.args.get('user_id')
    
    if not admin_id:
        return jsonify({"error": "User ID is required for access"}), 401

    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        profile_query = """
            SELECT p.role, array_remove(array_agg(aw.ward_id), NULL) 
            FROM public.profiles p
            LEFT JOIN public.admin_wards aw ON p.id = aw.user_id
            WHERE p.id = %s
            GROUP BY p.id;
        """
        cur.execute(profile_query, (admin_id,))
        profile = cur.fetchone()

        if not profile or profile[0] != 'admin':
            return jsonify({"error": "Unauthorized: Admin access required"}), 403
            
        wards_allocated = profile[1]

        # --- ADDED COALESCE(upvotes, 0) TO BOTH QUERIES ---
        if wards_allocated:
            query = """
                SELECT id, category, description, status, image_url, created_at, 
                       phone_number, ward_id, ST_Y(geom) as lat, ST_X(geom) as lon, COALESCE(upvotes, 0) as upvotes
                FROM complaints 
                WHERE ward_id = ANY(%s::int[])
                ORDER BY created_at DESC;
            """
            cur.execute(query, (wards_allocated,))
        else:
            query = """
                SELECT id, category, description, status, image_url, created_at, 
                       phone_number, ward_id, ST_Y(geom) as lat, ST_X(geom) as lon, COALESCE(upvotes, 0) as upvotes
                FROM complaints 
                ORDER BY created_at DESC;
            """
            cur.execute(query)

        records = cur.fetchall()

        complaints = []
        for row in records:
            db_date = row[5]
            iso_date = db_date.isoformat() + 'Z' if isinstance(db_date, datetime.datetime) else None

            complaints.append({
                "id": str(row[0]),
                "category": row[1],
                "description": row[2],
                "status": row[3].lower() if row[3] else 'pending',
                "image_url": row[4],
                "created_at": iso_date,
                "phone_number": row[6],
                "ward_id": row[7],
                "latitude": row[8],
                "longitude": row[9],
                "upvotes": row[10]
            })

        return jsonify({
            "status": "Success", 
            "wards_allocated": wards_allocated,
            "count": len(complaints),
            "data": complaints
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# 6. ADMIN: Update complaint status
@app.route('/api/v1/admin/complaints/<string:issue_id>/status', methods=['PATCH'])
def update_complaint_status(issue_id):
    new_status = request.json.get('status')
    valid_statuses = ['pending', 'in_progress', 'resolved', 'rejected']

    if new_status not in valid_statuses:
        return jsonify({"error": "Invalid status"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        update_query = "UPDATE complaints SET status = %s WHERE id = %s RETURNING id;"
        cur.execute(update_query, (new_status, issue_id))
        
        if cur.fetchone() is None:
            return jsonify({"error": "Complaint not found"}), 404
            
        conn.commit()
        return jsonify({"status": "Success", "message": f"Issue {issue_id} updated to {new_status}"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# 7. Fetch all wards for the frontend dropdowns
@app.route('/api/v1/wards', methods=['GET'])
def get_wards():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Fetch ward IDs, names, and geometry GeoJSON
        cur.execute("SELECT id, name, ST_AsGeoJSON(geom) FROM wards ORDER BY name ASC;")
        records = cur.fetchall()
        
        import json
        wards = []
        for row in records:
            wards.append({
                "id": row[0], 
                "name": row[1],
                "geom": json.loads(row[2]) if row[2] else None
            })
        
        return jsonify({"status": "Success", "data": wards}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# 9. ADMIN: Set new ward boundary
@app.route('/api/v1/wards', methods=['POST'])
def create_ward():
    data = request.json
    name = data.get('name')
    geom_wkt = data.get('geom_wkt')
    
    if not name or not geom_wkt:
        return jsonify({"error": "Missing name or geom_wkt"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Check for intersection overlaps using ST_Area of ST_Intersection > 0
        # This allows boundaries to seamlessly touch without throwing overlap errors
        overlap_query = """
            SELECT name FROM wards 
            WHERE ST_Area(ST_Intersection(geom, ST_GeomFromText(%s, 4326))) > 0;
        """
        cur.execute(overlap_query, (geom_wkt,))
        overlaps = cur.fetchall()
        
        if overlaps:
            conflicting_wards = [row[0] for row in overlaps]
            return jsonify({
                "status": "Conflict", 
                "error": "The drawn boundary overlaps with existing wards.",
                "conflicts": conflicting_wards
            }), 409

        insert_query = "INSERT INTO wards (name, geom) VALUES (%s, ST_GeomFromText(%s, 4326)) RETURNING id;"
        cur.execute(insert_query, (name, geom_wkt))
        new_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"status": "Success", "ward_id": new_id}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# 10. ADMIN: Get users for admin assignment
@app.route('/api/v1/admin/users', methods=['GET'])
def get_users():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT au.id, au.phone, p.role, array_remove(array_agg(aw.ward_id), NULL) 
            FROM auth.users au
            LEFT JOIN public.profiles p ON au.id = p.id
            LEFT JOIN public.admin_wards aw ON p.id = aw.user_id
            GROUP BY au.id, p.role;
        """
        cur.execute(query)
        records = cur.fetchall()
        
        users = []
        for row in records:
            users.append({
                "id": str(row[0]),
                "phone": row[1] if row[1] else "Unknown Phone",
                "role": row[2] if row[2] else "citizen",
                "wards_allocated": row[3] if row[3] else []
            })
            
        return jsonify({"status": "Success", "data": users}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# 11. ADMIN: Assign users to ward as admin
@app.route('/api/v1/wards/<int:ward_id>/admin', methods=['POST'])
def assign_ward_admin(ward_id):
    data = request.json
    user_ids = data.get('user_ids', [])

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Check if ward exists
        cur.execute("SELECT id FROM wards WHERE id = %s", (ward_id,))
        if not cur.fetchone():
            return jsonify({"error": "Ward not found"}), 404
            
        # 1. Clear existing junction mappings for this specific ward mapped in the panel
        cur.execute("DELETE FROM public.admin_wards WHERE ward_id = %s", (ward_id,))

        # 2. Rebuild the assignments directly according to the frontend's explicit checklist
        if user_ids:
            for uid in user_ids:
                cur.execute("INSERT INTO public.admin_wards (user_id, ward_id) VALUES (%s, %s)", (uid, ward_id))

        # 3. Synchronize `role` profiles automatically globally against the new mappings!
        cur.execute("""
            UPDATE public.profiles SET role = 'citizen' 
            WHERE role = 'admin' AND id NOT IN (SELECT user_id FROM public.admin_wards);
        """)
        cur.execute("""
            UPDATE public.profiles SET role = 'admin' 
            WHERE id IN (SELECT user_id FROM public.admin_wards);
        """)
        
        conn.commit()
        return jsonify({"status": "Success", "message": "Admins bulk assigned successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# 12. ADMIN: Delete a ward
@app.route('/api/v1/wards/<int:ward_id>', methods=['DELETE'])
def delete_ward(ward_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Cascading relationships in Postgres takes care of the mapping table.
        # But we must nullify any historic complaints linked to this now-vanished ward
        cur.execute("UPDATE complaints SET ward_id = NULL WHERE ward_id = %s", (ward_id,))
        
        # Finally delete the ward
        cur.execute("DELETE FROM wards WHERE id = %s RETURNING id", (ward_id,))
        if not cur.fetchone():
            return jsonify({"error": "Ward not found"}), 404
            
        conn.commit()
        return jsonify({"status": "Success", "message": "Ward deleted successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# 8. Vote End Point
@app.route('/api/v1/complaints/<string:issue_id>/vote', methods=['POST'])
def vote_issue(issue_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Increment the upvotes count safely
        update_query = "UPDATE complaints SET upvotes = COALESCE(upvotes, 1) + 1 WHERE id = %s RETURNING id;"
        cur.execute(update_query, (issue_id,))
        if not cur.fetchone():
            return jsonify({"error": "Issue not found"}), 404
            
        conn.commit()
        return jsonify({"status": "Success", "message": "Vote registered successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)