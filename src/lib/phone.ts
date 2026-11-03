// Polish phone numbers are stored as +48XXXXXXXXX (caregiver_contacts.phone check).

// Accepts 9 digits with an optional +48 or 0048 prefix; spaces, dashes and parentheses are ignored.
// Returns the normalized number, or null when the input is not a Polish phone number.
export function normalizePlPhone(input: string): string | null {
  const compact = input.replace(/[\s()-]/g, "");
  const match = /^(?:\+48|0048)?([0-9]{9})$/.exec(compact);
  return match ? `+48${match[1]}` : null;
}

// "+48600100200" -> "+48 600 100 200". Anything not in the normalized form is returned unchanged.
export function formatPlPhone(phone: string): string {
  const match = /^\+48([0-9]{3})([0-9]{3})([0-9]{3})$/.exec(phone);
  return match ? `+48 ${match[1]} ${match[2]} ${match[3]}` : phone;
}
