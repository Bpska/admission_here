import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlogProse } from "../src/components/blog/BlogProse";
import { cleanBlogBody, normalizeBlogBlocks, blogCollegeSlugs, removeBlogCollege } from "../src/lib/blog-content";

const rich = '<h2>College guide</h2><p><strong>Bold</strong> <em>Italic</em> <u>Underlined</u> <mark>Highlighted</mark> <a href="https://example.com">Official website</a></p><img src="/one.png" alt="Campus one"><p>Between pictures</p><img src="/two.png" alt="Campus two"><ol><li>First step</li></ol>';
const html = renderToStaticMarkup(<BlogProse content={rich} />);
for (const tag of ["h2", "strong", "em", "u", "mark", "ol", "li"]) assert.match(html, new RegExp(`<${tag}[ >]`));
assert.ok(html.indexOf("/one.png") < html.indexOf("Between pictures"));
assert.ok(html.indexOf("Between pictures") < html.indexOf("/two.png"));
assert.match(html, /noopener noreferrer/);
console.log('PASS Rich headings, formatting, links and multiple pictures retain document order');

const markdown = renderToStaticMarkup(<BlogProse content={'## Legacy heading\n\n**Bold** and *italic*\n\n[Website](https://example.com)\n\n- First item\n- Second item\n\n![Photo](/photo.png)'} />);
for (const tag of ["h2", "strong", "em", "a", "ul", "img"]) assert.match(markdown, new RegExp(`<${tag}[ >]`));
console.log('PASS Existing Markdown articles retain headings, lists, links, emphasis and pictures');

const unsafe = renderToStaticMarkup(<BlogProse content={'<p>Safe text</p><script>alert(1)</script><img src="/image.png" onerror="alert(2)"><a href="javascript:alert(3)">Unsafe link</a><iframe src="https://example.com"></iframe>'} />);
assert.ok(!unsafe.includes('<script')); assert.ok(!unsafe.includes('onerror')); assert.ok(!unsafe.includes('javascript:')); assert.ok(!unsafe.includes('<iframe'));
assert.match(unsafe, /Safe text/);
console.log('PASS Executable HTML and unsafe links are removed from article rendering');

const blocks = '<p>Intro</p><div data-blog-block="college" data-college-slug="nit-rourkela">College card</div><div data-blog-block="tldr">Summary</div><div data-blog-block="live">Live</div>';
assert.match(normalizeBlogBlocks(blocks), /<EmbeddedCollegeCTA slug="nit-rourkela" \/>/);
assert.equal(cleanBlogBody(blocks).trim(), '<p>Intro</p>');
console.log('PASS Editorial college, summary and live blocks survive rich-text conversion');

const recommended = '<p><strong>Article</strong></p><img src="/photo.png" alt="Campus"><div data-blog-block="college" data-college-slug="first-college">First</div>\n<EmbeddedCollegeCTA slug="second-college" />';
assert.deepEqual(blogCollegeSlugs(recommended), ['first-college', 'second-college']);
const changed = removeBlogCollege(recommended, 'first-college');
assert.deepEqual(blogCollegeSlugs(changed), ['second-college']);
assert.ok(changed.includes('<strong>Article</strong>')); assert.ok(changed.includes('/photo.png'));
console.log('PASS Changing college recommendations preserves rich text and pictures');
