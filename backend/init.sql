-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create Wards Table
CREATE TABLE wards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    geom GEOMETRY(Polygon, 4326)
);

-- 3. Create Complaints Table
CREATE TABLE complaints (
    id SERIAL PRIMARY KEY,
    image_url TEXT,
    category VARCHAR(50),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Pending',
    geom GEOMETRY(Point, 4326),
    ward_id INTEGER REFERENCES wards(id),
    phone_number VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    upvotes INTEGER DEFAULT 0
);

-- 4. Insert dummy ward
INSERT INTO wards (name, geom) VALUES (
 'Test Ward 01', 
 ST_GeomFromText('POLYGON((76.0 9.0, 77.0 9.0, 77.0 10.0, 76.0 10.0, 76.0 9.0))', 4326)
);

-- 5. Create a supabase bucket to store the images
insert into storage.buckets (id, name, public)
values ('complaints', 'complaints', true);

-- 5. Allow anyone to view/download images from the 'complaints' bucket
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'complaints');

-- 6. Create the custom table in the public schema
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role VARCHAR(20) DEFAULT 'citizen' CHECK (role IN ('admin', 'citizen'))
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING ( auth.uid() = id );

-- 7. Create admin_wards junction table
CREATE TABLE public.admin_wards (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ward_id INTEGER REFERENCES public.wards(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, ward_id)
);

-- 8. Trigger to add new users to profile table securely
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into the public profiles table automatically downgrading everyone to citizen regardless of metadata injection requests
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'citizen');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();