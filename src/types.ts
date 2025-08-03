// src/types.ts
export interface Post {
  url: string;
  frontmatter: {
    title: string;
    description?: string;
    pubDate: string;
    writer: string;
  };
}