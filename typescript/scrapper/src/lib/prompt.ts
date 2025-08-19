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

  projects: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
    })
  ),

  articles: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
    })
  ),
  interests: z.string(),
  employments: z.array(
    z.object({
      company: z.string(),
      position: z.string(),
      start_date: z.iso.date().nullable(),
      end_date: z.iso.date().nullable(),
    })
  ),
  socials: z.array(z.string()),
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
- Estimated Salary
- Notable Developer Projects
- Articles or a personal site
- Interests
- Current and Past Employments
- Social Media Accounts

Additionally, 

- all dates need to be in a valid ISO 8601 format or null.
- all URLs need to be valid and reachable.
- numbers need to be integers.

When you are done, return a JSON object matching the following schema:

${JSON.stringify(z.toJSONSchema(zScrapperSchema), null, 2)}
`.trim();
}
