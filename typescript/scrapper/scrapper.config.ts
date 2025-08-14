import { z } from "zod";

import type { ScrapperSchema } from "@/lib/schema";

export const schema: ScrapperSchema = {
  input: {
    slug: "name",
    label: "Name",
    description: "The name of the potential candidate.",
    schema: z.string(),
  },
  columns: [
    {
      slug: "residence",
      label: "Current Residence",
      description: "The person's current city and country of residence.",
      schema: z.string(),
    },
    {
      slug: "age",
      label: "Estimated Age",
      description: "The person's estimated age.",
      schema: z.number(),
    },
    {
      slug: "salary",
      label: "Estimated Salary",
      description: "The person's estimated annual salary in USD.",
      schema: z.number(),
    },
    {
      slug: "projects",
      label: "Notable Developer Projects",
      description: "The person's three notable developer projects.",
      schema: z.array(z.string()),
    },
    {
      slug: "articles",
      label: "Articles or a personal site",
      description: "The person's articles or a personal site.",
      schema: z.array(z.string()),
    },
    {
      slug: "interests",
      label: "Interests",
      description: "The person's interests.",
      schema: z.array(z.string()),
    },

    {
      slug: "employments",
      label: "Current and Past Employments",
      description: "The person's current and past employments.",
      schema: z.array(z.string()),
    },
    {
      slug: "socials",
      label: "Social Media Accounts",
      description: "The person's social media posts and social media accounts.",
      schema: z.array(z.string()),
    },
  ],
};
