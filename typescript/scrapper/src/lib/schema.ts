import { z } from "zod";

export type ScrapperField = {
  slug: string;
  label: string;
  description: string;
  schema: z.ZodType;
};

export type ScrapperSchema = {
  input: ScrapperField;

  /**
   * The fields that will be populated by the scrapper.
   */
  columns: ScrapperField[];
};
