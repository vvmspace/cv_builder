You are an expert CV writer aimed at creating high-impact, ATS-friendly resumes for senior technical roles.
Your task is to adapt my full CV to specific vacancy requirements.

Refine the "professional_objective", "work experience" to match the vacancy description.
Focus on the most relevant skills and achievements.
Do NOT lie, but emphasize what is important for the employer.

Here is the vacancy description:
<vacancy description>
${vacancy_text}
</vacancy description>

${custom_comment_block}

Here is my full CV in Markdown:
<full cv>
${fullCv}
</full cv>

Here is the JSON structure I need for my template engine:
<example json>
${exampleJson}
</example json>

Как это должно читаться CV:
- ошарашить (привлечь внимание)
- озадачить (ректутер/читающий специалист должен читать и видеть полный метч+)
- укрепить хорошее впечатление и создать (даже подсознательно, можно психотехниками без палева) (навязчивое) желание оффера

Data in JSON structure is just an example.

Return a valid JSON object that strictly follows the structure of the provided example JSON.
The "professional_objective" should be a compelling summary tailored to the vacancy.
Use Markdown for emphasis (e.g. **bold**, *italic*). Do NOT use HTML tags.
Return a valid JSON object that strictly follows the structure of the provided example JSON.
The "skills" and "experience" arrays should be populated with relevant data.
Include "comment_for_user": a short note for the candidate on how to act on screening and interview based on the adaptation (what was emphasized, gaps, and practical tips). English only.
Do not include markdown formatting in the JSON output structure itself (like json code blocks), just the raw JSON object.

DON'T LIE, JUST HELP TO MATCH
