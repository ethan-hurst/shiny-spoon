// contentlayer.config.ts
import { defineDocumentType, makeSource } from "contentlayer/source-files";
import readingTime from "reading-time";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrismPlus from "rehype-prism-plus";
import rehypeSlug from "rehype-slug";
var Post = defineDocumentType(() => ({
  name: "Post",
  filePathPattern: `blog/**/*.mdx`,
  contentType: "mdx",
  fields: {
    title: { type: "string", required: true },
    description: { type: "string", required: true },
    date: { type: "date", required: true },
    published: { type: "boolean", default: true },
    image: { type: "string", required: true },
    authors: { type: "list", of: { type: "string" }, required: true },
    categories: { type: "list", of: { type: "string" }, required: true },
    tags: { type: "list", of: { type: "string" }, default: [] }
  },
  computedFields: {
    url: {
      type: "string",
      resolve: (post) => `/blog/${post._raw.flattenedPath.replace("blog/", "")}`
    },
    slug: {
      type: "string",
      resolve: (post) => post._raw.flattenedPath.replace("blog/", "")
    },
    readingTime: {
      type: "json",
      resolve: (post) => readingTime(post.body.raw)
    }
  }
}));
var Doc = defineDocumentType(() => ({
  name: "Doc",
  filePathPattern: `docs/**/*.mdx`,
  contentType: "mdx",
  fields: {
    title: { type: "string", required: true },
    description: { type: "string", required: true },
    category: { type: "string", required: true },
    order: { type: "number", default: 0 },
    version: { type: "string", default: "v1" }
  },
  computedFields: {
    url: {
      type: "string",
      resolve: (doc) => `/docs/${doc._raw.flattenedPath.replace("docs/", "")}`
    },
    slug: {
      type: "string",
      resolve: (doc) => doc._raw.flattenedPath.replace("docs/", "")
    }
  }
}));
var HelpArticle = defineDocumentType(() => ({
  name: "HelpArticle",
  filePathPattern: `help/**/*.mdx`,
  contentType: "mdx",
  fields: {
    title: { type: "string", required: true },
    description: { type: "string", required: true },
    category: { type: "string", required: true },
    relatedArticles: { type: "list", of: { type: "string" }, default: [] },
    keywords: { type: "list", of: { type: "string" }, default: [] }
  },
  computedFields: {
    url: {
      type: "string",
      resolve: (article) => `/help/${article._raw.flattenedPath.replace("help/", "")}`
    },
    slug: {
      type: "string",
      resolve: (article) => article._raw.flattenedPath.replace("help/", "")
    }
  }
}));
var contentlayer_config_default = makeSource({
  contentDirPath: "./content",
  documentTypes: [Post, Doc, HelpArticle],
  mdx: {
    remarkPlugins: [],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
      [rehypePrismPlus, { theme: "github-dark" }]
    ]
  }
});
export {
  Doc,
  HelpArticle,
  Post,
  contentlayer_config_default as default
};
//# sourceMappingURL=compiled-contentlayer-config-RLAE3WUY.mjs.map
