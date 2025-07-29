#!/usr/bin/env python3
"""
Batch update Markdown/MDX blog posts to:
  • Change frontmatter layout
  • Inject post-image-sm class into <img> tags
  • Replace affiliate HTML block (either inline HTML or remove component)
  • Remove inserted Affiliates import/component

Usage:
  python batch_update_posts.py [--posts-dir DIR] [--new-layout PATH]
      [--layout] [--img-class] [--affiliates-inline] [--remove-affiliates]

Options:
  --posts-dir         Directory containing .md/.mdx files (default: src/pages/posts)
  --new-layout        New layout path (default: ../../layouts/ReviewPostLayout.astro)
  --layout            Apply layout change
  --img-class         Inject post-image-sm class into <img> tags
  --affiliates-inline Replace affiliate block with inline HTML snippet
  --remove-affiliates Remove Affiliates import and component
  -h, --help          Show this help message and exit
"""
import os
import re
import argparse
from glob import glob

# Patterns
default_layout_pattern = re.compile(r'^(layout:\s*["\'])(.*?)(["\'])', re.MULTILINE)
affiliate_html_pattern = re.compile(r'<section class="affiliates">[\s\S]*?</section>', re.MULTILINE)
frontmatter_pattern = re.compile(r'^(---\s*\n[\s\S]*?\n---\s*\n)', re.MULTILINE)
affiliate_component_pattern = re.compile(r'<Affiliates affiliate=\{frontmatter\.affiliate\} ?/>\n?', re.MULTILINE)
import_affiliates_pattern = re.compile(r'^import Affiliates from ["\'].*?["\'];?\n', re.MULTILINE)

# Helper: inject 'post-image-sm' into <img> tags
def inject_img_class(text):
    text = re.sub(
        r'(<img\b[^>]*\bclass=")([^"]*)(")',
        lambda m: f"{m.group(1)}{m.group(2)} post-image-sm{m.group(3)}",
        text
    )
    text = re.sub(
        r'(<img\b)(?![^>]*\bclass=)([^>]*)(>)',
        r"\1 class=\"post-image-sm\"\2\3",
        text
    )
    return text

# Inline affiliate HTML snippet
AFFILIATE_SNIPPET = '''<section class="affiliates">
  <ul>
    {affiliate.amazon && (
      <li>
        <a class="affiliate-link" href={affiliate.amazon} target="_blank" rel="noopener noreferrer">
          Buy on Amazon
        </a>
      </li>
    )}
    {affiliate.highpointscientific && (
      <li>
        <a class="affiliate-link" href={affiliate.highpointscientific} target="_blank" rel="noopener noreferrer">
          Buy at Highpoint Scientific
        </a>
      </li>
    )}
    {affiliate.astroshop && (
      <li>
        <a class="affiliate-link" href={affiliate.astroshop} target="_blank" rel="noopener noreferrer">
          Buy at AstroShop
        </a>
      </li>
    )}
  </ul>
</section>'''

# Process a single file
def process_file(filepath, args):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    updated = content

    # Remove any previous Affiliates import or component
    if args.remove_affiliates:
        updated = import_affiliates_pattern.sub('', updated)
        updated = affiliate_component_pattern.sub('', updated)

    # Replace affiliate HTML with inline snippet
    if args.affiliates_inline:
        # Inject snippet after frontmatter
        updated = affiliate_html_pattern.sub(AFFILIATE_SNIPPET, updated)

    # Update layout in frontmatter
    if args.layout:
        updated = default_layout_pattern.sub(
            lambda m: f"{m.group(1)}{args.new_layout}{m.group(3)}",
            updated,
            count=1
        )

    # Inject image class
    if args.img_class:
        updated = inject_img_class(updated)

    # Write back if changed
    if updated != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated)
        print(f"Updated: {filepath}")
    else:
        print(f"No changes: {filepath}")

# Main entry
def main():
    parser = argparse.ArgumentParser(
        description="Batch update layouts, image classes, and affiliates in blog posts"
    )
    parser.add_argument(
        '--posts-dir', default='src/pages/posts',
        help='Directory for markdown files'
    )
    parser.add_argument(
        '--new-layout', default='../../layouts/ReviewPostLayout.astro',
        help='New layout path'
    )
    parser.add_argument(
        '--layout', action='store_true',
        help='Apply layout change'
    )
    parser.add_argument(
        '--img-class', action='store_true',
        help='Inject post-image-sm class into <img> tags'
    )
    parser.add_argument(
        '--affiliates-inline', action='store_true',
        help='Replace affiliate block with inline HTML snippet'
    )
    parser.add_argument(
        '--remove-affiliates', action='store_true',
        help='Remove Affiliates import and component'
    )
    args = parser.parse_args()

    # Gather markdown files
    patterns = [os.path.join(args.posts_dir, f"*.{ext}") for ext in ('md', 'mdx')]
    files = []
    for pat in patterns:
        files.extend(glob(pat))

    if not files:
        print(f"No markdown files found in {args.posts_dir}")
        return

    # Ensure at least one operation is chosen
    if not (args.layout or args.img_class or args.affiliates_inline or args.remove_affiliates):
        print("No operations specified. Use --layout, --img-class, --affiliates-inline, or --remove-affiliates.")
        return

    for filepath in files:
        process_file(filepath, args)

if __name__ == '__main__':
    main()
