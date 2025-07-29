#!/usr/bin/env python3
import os
import re
from glob import glob

# Directory where your posts live (adjust if necessary)
POSTS_DIR = "src/pages/posts"

# Regex to match the layout line in YAML frontmatter
layout_pattern = re.compile(r'^(layout:\s*["\'])(.*?)(["\'])', re.MULTILINE)

# New layout path to apply
NEW_LAYOUT_PATH = "../../layouts/ReviewPostLayout.astro"

# Gather all .md and .mdx files
files = []
for ext in ("md", "mdx"):
    files.extend(glob(os.path.join(POSTS_DIR, f"*.{ext}")))

if not files:
    print(f"No markdown files found in {POSTS_DIR}")
    exit(1)

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    match = layout_pattern.search(content)
    if not match:
        print(f"–  No layout field found in {filepath}")
        continue

    old_line = match.group(0)
    new_line = f"{match.group(1)}{NEW_LAYOUT_PATH}{match.group(3)}"

    print(f"\nFile: {filepath}")
    print(f"Old: {old_line}")
    print(f"New: {new_line}")
    choice = input("Apply this change? [Y/n] ").strip().lower()

    if choice in ("", "y", "yes"):
        # Apply only the first occurrence
        updated_content = layout_pattern.sub(
            lambda m: f"{m.group(1)}{NEW_LAYOUT_PATH}{m.group(3)}",
            content,
            count=1
        )
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        print(f"✅ Updated layout in {filepath}")
    else:
        print(f"⏭  Skipped {filepath}")