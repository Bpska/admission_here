"use client";
import { RichTextEditor } from "./RichTextEditor";
import { ImageUploadField } from "./ImageUploadField";

export type InitialCollegeBlog = { enabled: boolean; title: string; contentMdx: string; category: string; featuredImageUrl: string; metaDescription: string; publish: boolean; showOnWebsiteBlog: boolean };
export const emptyCollegeBlog = (): InitialCollegeBlog => ({ enabled: false, title: "", contentMdx: "", category: "COLLEGE_ROUNDUP", featuredImageUrl: "", metaDescription: "", publish: false, showOnWebsiteBlog: false });
export function InitialCollegeBlogEditor({ value, onChange, disabled, onBusyChange, requiresApproval }: {
  value: InitialCollegeBlog; onChange: (value: InitialCollegeBlog) => void; disabled: boolean; onBusyChange: (busy: boolean) => void; requiresApproval: boolean;
}) {
  return <section id="college-blogs" className="scroll-mt-6 space-y-4 rounded-2xl border bg-card p-6">
    <h2 className="text-lg font-bold">Write a separate blog for this college</h2>
    <p className="text-sm text-muted-foreground">Write an article here while adding the college. Saving the college also saves this as a separate blog article, linked only to this college.</p>
    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={value.enabled} disabled={disabled} onChange={event => onChange({ ...value, enabled: event.target.checked })} />Add a blog article with this college</label>
    {value.enabled && <>
      <fieldset className="space-y-2 rounded-lg border p-3"><legend className="px-1 text-xs font-semibold">Where should this blog appear?</legend><label className="flex gap-2 text-sm"><input type="radio" name="initial-blog-destination" checked={!value.showOnWebsiteBlog} disabled={disabled} onChange={() => onChange({ ...value, showOnWebsiteBlog: false })} />College blogs only</label><label className="flex gap-2 text-sm"><input type="radio" name="initial-blog-destination" checked={value.showOnWebsiteBlog} disabled={disabled} onChange={() => onChange({ ...value, showOnWebsiteBlog: true })} />Website blog page</label></fieldset>
      <label className="block space-y-1 text-xs font-semibold"><span>Blog title *</span><input required minLength={3} maxLength={200} disabled={disabled} value={value.title} onChange={event => onChange({ ...value, title: event.target.value })} className="w-full rounded-lg border bg-background p-2.5 text-sm" /></label>
      <label className="block space-y-1 text-xs font-semibold"><span>Blog category</span><select disabled={disabled} value={value.category} onChange={event => onChange({ ...value, category: event.target.value })} className="w-full rounded-lg border bg-background p-2.5 text-sm">
        <option value="COLLEGE_ROUNDUP">College guide</option><option value="ADMISSION_ALERT">Admission update</option><option value="CAREER_GUIDE">Career guide</option><option value="SCHOLARSHIP">Scholarships</option><option value="EXAM_NEWS">Exam news</option><option value="CUTOFF_ANALYSIS">Cutoff analysis</option>
      </select></label>
      <ImageUploadField label="College blog cover photo" values={value.featuredImageUrl ? [value.featuredImageUrl] : []} onChange={images => onChange({ ...value, featuredImageUrl: images[0] || "" })} disabled={disabled} onBusyChange={onBusyChange} />
      <div className="space-y-1"><p className="text-xs font-semibold">Blog article *</p><RichTextEditor required label="College blog article" value={value.contentMdx} onChange={contentMdx => onChange({ ...value, contentMdx })} disabled={disabled} /></div>
      <label className="block space-y-1 text-xs font-semibold"><span>SEO description (optional)</span><textarea rows={3} maxLength={500} disabled={disabled} value={value.metaDescription} onChange={event => onChange({ ...value, metaDescription: event.target.value })} className="w-full rounded-lg border bg-background p-2.5 text-sm" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={value.publish} onChange={event => onChange({ ...value, publish: event.target.checked })} />Publish the blog when this college is published{requiresApproval ? " after administrator approval" : ""}</label>
      <p className="text-xs text-muted-foreground">Leave unchecked to save the blog as a draft. If the college is saved as a draft, the blog also stays a draft. You can edit it later from the college’s Blogs section.</p>
    </>}
  </section>;
}
