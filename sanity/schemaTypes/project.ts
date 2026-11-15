import { defineField, defineType } from "sanity";

export const projectSchema = defineType({
  name: "project",
  title: "Project",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Project name", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "repositoryUrl",
      title: "Github repository",
      type: "url",
      validation: (rule) =>
        rule.required().uri({ scheme: ["https"] }).custom((value) =>
          !value || /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(value)
            ? true
            : "Provide the URL of a GitHub repository.",
        ),
    }),
    defineField({
      name: "summary",
      title: "Description",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(300),
    }),
    defineField({
      name: "impact",
      title: "Impact or contribution",
      type: "text",
      rows: 3,
      validation: (rule) => rule.max(300),
    }),
    defineField({
      name: "techStack",
      title: "Technologies",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
    }),
    defineField({ name: "featured", title: "Display on the home page", type: "boolean", initialValue: false }),
    defineField({ name: "sortOrder", title: "Order", type: "number", initialValue: 100 }),
  ],
});
