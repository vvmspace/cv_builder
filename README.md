# CV Builder

A system to generate tailored HTML and PDF variations of your CV for specific job vacancies using an LLM (Gemini by default).

## Features

- **LLM-Powered tailoring:** Parses a job vacancy and customizes your CV structure, professional summary, and relevant experience to match the role better without lying.
- **Dynamic Render:** Automatically converts the LLM's JSON output into a clean HTML resume.
- **PDF Generation:** Converts the generated HTML into a print-ready A4 PDF format immediately.

## Directory Structure

- `full_cv.md`: Your complete CV containing all your experience, skills, and education history. If not found, `full_cv.example.md` is used as a fallback.
- `cv.json`: The JSON schema defining the precise structure of the CV that the LLM must output to match the HTML template perfectly. If not found, `cv.example.json` is used.
- `prompt.md`: The base LLM prompt that coordinates the merging of your `full_cv.md`, the target vacancy text, and the target `cv.json` schema. If not found, `prompt.example.md` is used.
- `templates/`: Contains HTML template files (e.g. `dark.html`, `light.html`) to render the structured CV.
- `cvs/`: Output directory where generated `.html` and `.pdf` resumes are saved, as well as optional `.comment.md` files.
- `tools/`: Internal scripts and helpers (e.g., LLM clients, template renderers).

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the project root and add your selected API keys.
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Provide Your Data by Overriding fallbacks:**
   To safely populate your actual data without tracking it in Git or breaking the example default layout:
   - Create `full_cv.md` (you can copy context from `full_cv.example.md`) and paste your entire raw CV.
   - Create `cv.json` if you want to modify the fields or the template context structure.
   - Create `prompt.md` if you wish to adjust the core system prompts given to the LLM.

4. **Start the Express Server:**
   ```bash
   npm run start
   # or
   node server.js
   ```

## Usage

### Web Interface (Recommended)

After starting the server, open your browser and navigate to:
```
http://localhost:3000
```
There you will find a user-friendly web interface where you can:
- Paste the job description.
- Add any custom instructions or comments (e.g., "Focus on my Web3 and High-Load experience").
- Select your preferred theme (Dark/Light).
- Choose the LLM model to use.
- Generate and download the resulting PDF in a single click.

### API Endpoint

Alternatively, you can generate a new CV programmatically by calling the `/api/v1/generate-cv` endpoint. Your prompt will be constructed and sent to the LLM automatically.

```bash
curl -X POST http://localhost:3000/api/v1/generate-cv \
     -H "Content-Type: application/json" \
     -d '{
       "vacancy_text": "Paste the complete vacancy description here...",
       "custom_comment": "Focus on my Web3 and High-Load experience.",
       "template": "dark"
     }'
```

The server will return the actual URLs and absolute paths to the generated HTML and PDF files.

```json
{
  "success": true,
  "html_url": "/cvs/cv_17...html",
  "pdf_url": "/cvs/cv_17...pdf",
  "pdf_absolute_path": "/Users/.../cv_builder/cvs/cv_17...pdf"
}
```

After each successful `POST /api/v1/generate-cv` (or `/api/v1/generate_cv`) request, the server also stores the latest generated CV JSON to:
- local/dev: `./last.json`
- Netlify/Lambda runtime: `/tmp/last.json`

### Build PDF from Ready JSON (CLI)

If you already have a CV JSON (for example, `last.json`) and only need to render PDF/HTML:

```bash
npm run build:pdf-from-json -- ./last.json ./cvs/manual_dark.pdf dark
```

Arguments:
- `input_json_file` (required): path to CV JSON.
- `output_pdf_file` (optional): output PDF path. If omitted, files are created in `./cvs`.
- `template` (optional): `dark` (default) or `light`.
