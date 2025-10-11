import { z } from "zod";

export const zScrapperSchema = z.object({
  name: z.string(),
  residence: z.string().nullable(),

  estimated_age: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
  }),
  estimated_salary: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
  }),

  projects: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
      })
    )
    .default([]),

  articles: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      })
    )
    .default([]),

  interests: z.string().nullable(),

  employments: z
    .array(
      z.object({
        company: z.string(),
        position: z.string(),
        start_date: z.iso.date().nullable(),
        end_date: z.iso.date().nullable(),
      })
    )
    .default([]),

  socials: z.array(z.string()).default([]),
});

export type ScrapperSchemaZod = typeof zScrapperSchema;

/**
 * @param name - The name of the person to scrape.
 * @returns The prompt for the agent to scrape the web for information about the person.
 */
export function getAgentPrompt(name: string) {
  return `
You are a helpful assistant that scavenges the web for information about "${name}" who just applied for a job.

The role the person is applying for is:

- Infrastructure Engineer,
- AWS, Terraform, Kubernetes, Docker stack
- Fully Remote

Collect as many of the following information as possible, ideally combining multiple sources to get the most complete picture.

- Residence
- Estimated Age
- Estimated Salary (optional - only if you can find reliable indicators)
- Notable Developer Projects
- Articles or a personal site
- Interests
- Current and Past Employments
- Social Media Accounts

IMPORTANT INSTRUCTIONS:

- If you cannot find certain information, return null for nullable fields or empty arrays for array fields.
- It is ACCEPTABLE to return partial information - do NOT fail the task if you can't find everything.
- Focus on finding whatever information IS available rather than trying to complete every field.
- All dates need to be in valid ISO 8601 format (YYYY-MM-DD) or null.
- All URLs need to be valid and reachable.
- Numbers need to be integers.

CRITICAL - HOW TO RETURN DATA:

When you call the 'done' action, the 'text' field MUST contain ONLY the raw JSON object - do NOT include any explanations, summaries, or additional text.

Example of CORRECT done action:
{
  "done": {
    "text": "{\\"name\\":\\"John Doe\\",\\"residence\\":\\"San Francisco\\",\\"estimated_age\\":{\\"min\\":25,\\"max\\":30},...}",
    "success": true
  }
}

Example of INCORRECT done action (DO NOT DO THIS):
{
  "done": {
    "text": "I found the following information... Here is the JSON: {...}",
    "success": true
  }
}

The JSON schema you must match:

${JSON.stringify(z.toJSONSchema(zScrapperSchema), null, 2)}

Remember: Return ONLY the JSON object in the done action text field. No descriptions, no summaries, just the raw JSON.
`.trim();
}
