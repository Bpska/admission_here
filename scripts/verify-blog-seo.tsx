import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { analyzeBlogContent, topicAppears } from "../src/lib/blog-readability";
import { BlogProse } from "../src/components/blog/BlogProse";
import { generateNewsArticleJsonLd } from "../src/lib/seo/json-ld";

const rich = '<p>Compare <strong>MCA colleges</strong> &amp; admission options.</p><h2>Fees &amp; eligibility</h2><h3>Application steps</h3><h2>Fees &amp; eligibility</h2><img src="/campus.jpg" alt="Campus courtyard"><img src="/library.jpg"><a href="/college/test">College details</a><a href="https://official.example/admission">Official notice</a><script>hidden private words</script><EmbeddedCollegeCTA slug="example" />';
const analysis = analyzeBlogContent(rich);
assert.equal(analysis.headings.length, 3);
assert.equal(analysis.images.length, 2);
assert.equal(analysis.images.filter(image => !image.alt).length, 1);
assert.equal(analysis.internalLinks, 1);
assert.equal(analysis.externalLinks, 1);
assert.ok(!analysis.text.includes("hidden private words"));
assert.ok(!analysis.text.includes("EmbeddedCollegeCTA"));
assert.equal(analysis.intro, "Compare MCA colleges & admission options.");
assert.equal(topicAppears("Choose the right MCA colleges", "mca-colleges"), true);
assert.equal(topicAppears("Medical subjects", "med"), false);

const md = analyzeBlogContent('## Apply for MCA\n\nRead the [official notice](https://official.example) and [college details](/college/test).\n\n![Campus garden](/garden.jpg)');
assert.equal(md.headings[0].text, "Apply for MCA");
assert.equal(md.images[0].alt, "Campus garden");
assert.ok(!md.text.includes("https://"), "Words exclude link destination URLs");
assert.equal(analyzeBlogContent("<p>" + Array(401).fill("student").join(" ") + "</p>").readingMinutes, 3);
assert.equal(analyzeBlogContent("<div><br></div>").wordCount, 0);

const html = renderToStaticMarkup(<BlogProse content={'<h1 id="location">Title in body</h1>' + rich + '<h2>प्रवेश जानकारी</h2>'} />);
assert.ok(!html.includes("<h1"), "Body content does not add another H1");
const ids = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, 5);
assert.equal(new Set(ids).size, ids.length, "Repeated headings receive unique anchors");
assert.ok(ids.every(id => id.startsWith("article-")));
assert.ok(!html.includes('<script'));
assert.match(html, /href="\/college\/test"/);
assert.ok(!/<a href="\/college\/test"[^>]*target=/.test(html), "Internal links stay in the same tab");
assert.match(html, /noopener noreferrer/);

const schema = generateNewsArticleJsonLd({title:"MCA guide",slug:"mca-guide",authorName:"Editor",publishedAt:"2026-11-01T00:00:00Z",updatedAt:"2026-11-02T00:00:00Z",canonicalPath:"/college/test/blogs/mca-guide",featuredImageUrl:"/api/v1/blog-images/example",articleType:"BlogPosting",wordCount:401,readingMinutes:3,category:"CAREER GUIDE",tags:["MCA"]});
assert.equal(schema["@type"], "BlogPosting");
assert.equal(schema.wordCount,401);
assert.equal(schema.timeRequired,"PT3M");
assert.ok(schema.image?.[0].startsWith('https://'));
assert.ok(schema.mainEntityOfPage["@id"].endsWith('/college/test/blogs/mca-guide'));
assert.ok(!("image" in generateNewsArticleJsonLd({title:"No image",slug:"no-image",authorName:"Editor"})), "Do not invent article image URLs");
console.log("Blog SEO checks passed: rich text/Markdown analysis, real word counts, scoped heading anchors, duplicate/non-Latin headings, safe internal links, article schema, and absolute image URLs.");
