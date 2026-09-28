# OnBeat Server

OnBeat backend API, built with Fastify and TypeScript. Connects to SoundNet (via RapidAPI) for track analysis and Supabase for storing user data and run history.

## Requirements

- Node.js 22 or newer
- A Supabase project
- A RapidAPI key subscribed to the SoundNet Track Analysis API

## 1. Install

```bash
npm install
```

## 2. Set up environment variables

Copy `.env.example` to `.env` in the project root and fill in the values:

```bash
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
RAPIDAPI_KEY=your-rapidapi-key
RAPIDAPI_HOST=track-analysis.p.rapidapi.com
SOUNDNET_CHUNK_SIZE=4
```

## 3. Set up the database

In the Supabase SQL Editor, run these files in order:

1. `supabase/schema.sql` (creates the tables)
2. `supabase/seed-track-cues.sql` (adds the track cues)

## 4. Run the server

```bash
npm run dev
npm run build      
npm run start
```

The server runs at `http://localhost:3000`. 
Swagger API docs are at `http://localhost:3000/docs`.
