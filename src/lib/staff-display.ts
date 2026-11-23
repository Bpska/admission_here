/** Keep the person's name and editable job title separate from access roles. */
export function staffDisplayName(person: {
  name: string;
  designation?: string | null;
}) {
  const designation = person.designation?.trim();
  return designation ? `${person.name} · ${designation}` : person.name;
}
