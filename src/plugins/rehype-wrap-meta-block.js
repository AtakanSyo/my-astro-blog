// Wrap consecutive meta sections in <div class="review-meta-block">…</div>
import { visit } from 'unist-util-visit';

const TARGET_CLASSES = new Set([
  'info-tags',
  'pros-cons',
  'ratings',
  'affiliates',
  'affiliate-vendors',
]);

// helper: read className from hast or mdx AST nodes
function getClassList(node) {
  // rehype/hast 'element'
  if (node?.properties?.className) {
    const c = node.properties.className;
    return Array.isArray(c) ? c : String(c).split(/\s+/);
  }
  // mdxJsxFlowElement: attributes is an array of {name, value}
  if (node?.type === 'mdxJsxFlowElement' && Array.isArray(node.attributes)) {
    const attr = node.attributes.find(a => a.name === 'class' || a.name === 'className');
    if (attr?.value) return String(attr.value).split(/\s+/);
  }
  return [];
}

function isTarget(node) {
  // plain <section class="..."> or <div class="...">
  if (node?.type === 'element' && (node.tagName === 'section' || node.tagName === 'div')) {
    const classes = getClassList(node);
    return classes.some(c => TARGET_CLASSES.has(c));
  }

  // MDX component like <Affiliates ... />
  if (node?.type === 'mdxJsxFlowElement') {
    // treat <Affiliates> as part of the block, or any component with class names we know
    if (node.name === 'Affiliates') return true;
    const classes = getClassList(node);
    return classes.some(c => TARGET_CLASSES.has(c));
  }

  return false;
}

export default function rehypeWrapMetaBlock() {
  return (tree) => {
    visit(tree, 'root', (root) => {
      const children = root.children || [];
      const out = [];
      let i = 0;

      while (i < children.length) {
        if (!isTarget(children[i])) {
          out.push(children[i++]);
          continue;
        }

        // collect a run of consecutive target nodes
        const start = i;
        while (i < children.length && isTarget(children[i])) i++;
        const slice = children.slice(start, i);

        out.push({
          type: 'element',
          tagName: 'div',
          properties: { className: ['review-meta-block'] },
          children: slice,
        });
      }

      root.children = out;
    });
  };
}