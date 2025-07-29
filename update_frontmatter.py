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

# Helper to inject `post-image-sm` class into <img> tags

def inject_img_class(text):
    # 1) Append to existing class attributes
    text = re.sub(
        r'(<img\b[^>]*\bclass=")([^"]*)(")',
        lambda m: f"{m.group(1)}{m.group(2)} post-image-sm{m.group(3)}",
        text
    )
    # 2) Add class attribute if missing
    text = re.sub(
        r'(<img\b)(?![^>]*\bclass=)([^>]*)(>)',
        r"\1 class=\"post-image-sm\"\2\3",
        text
    )
    return text

# Gather all markdown files
files = []
for ext in ("md", "mdx"):
    files.extend(glob(os.path.join(POSTS_DIR, f"*.{ext}")))

if not files:
    print(f"No markdown files found in {POSTS_DIR}")
    exit(1)

# Process each file interactively
for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"\n=== Processing: {filepath} ===")
    updated = content

    # Prompt for layout update
    layout_match = layout_pattern.search(content)
    if layout_match:
        old_layout = layout_match.group(0)
        new_layout = f"{layout_match.group(1)}{NEW_LAYOUT_PATH}{layout_match.group(3)}"
        print(f"Old layout: {old_layout}")
        print(f"New layout: {new_layout}")
        choice = input("Apply layout change? [Y/n] ").strip().lower()
        if choice in ("", "y", "yes"):
            updated = layout_pattern.sub(
                lambda m: f"{m.group(1)}{NEW_LAYOUT_PATH}{m.group(3)}",
                updated,
                count=1
            )
            print("✅ Layout updated.")
        else:
            print("⏭ Layout skipped.")
    else:
        print("– No layout field found.")

    # Prompt for image class injection
    inject_choice = input("Add 'post-image-sm' class to <img> tags? [Y/n] ").strip().lower()
    if inject_choice in ("", "y", "yes"):
        updated = inject_img_class(updated)
        print("✅ Image classes injected.")
    else:
        print("⏭ Image class injection skipped.")

    # Save changes if any
    if updated != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated)
        print(f"Saved changes to {filepath}.")
    else:
        print(f"No changes made to {filepath}.")
