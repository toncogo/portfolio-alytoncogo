import { defineField, defineType } from "sanity";

export const siteSettingsSchema = defineType({
  name: "siteSettings",
  title: "Page settings",
  type: "document",
  fields: [
    defineField({ name: "pageTitle", title: "Page title", type: "string" }),
    defineField({ name: "headline", title: "Main title", type: "string" }),
    defineField({
      name: "heroDescription",
      title: "Initial description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "aboutIntro",
      title: "About me (summary)",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "accentColor",
      title: "Accent color (hexadecimal)",
      description: "Example cyberpunk: #00e5ff",
      type: "string",
      validation: (rule) =>
        rule.regex(/^#[0-9a-fA-F]{6}$/).error("Use a hexadecimal color #RRGGBB."),
    }),
    defineField({
      name: "profileImageUrl",
      title: "Professional photo URL",
      type: "url",
    }),
    defineField({
      name: "instagramUrl",
      title: "Instagram",
      type: "url",
      validation: (rule) => rule.uri({ scheme: ["https"] }),
    }),
    defineField({
      name: "whatsappUrl",
      title: "WhatsApp (link wa.me)",
      type: "url",
      validation: (rule) =>
        rule.uri({ scheme: ["https"] }).custom((value) =>
          !value || /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(value)
            ? true
            : "Use a link https://wa.me/ or api.whatsapp.com.",
        ),
    }),
    defineField({
      name: "facebookUrl",
      title: "Facebook",
      type: "url",
      validation: (rule) => rule.uri({ scheme: ["https"] }),
    }),
    defineField({
      name: "discordUrl",
      title: "Discord (invite or profile)",
      type: "url",
      validation: (rule) => rule.uri({ scheme: ["https"] }),
    }),
  ],
});
