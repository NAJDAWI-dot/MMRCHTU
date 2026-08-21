/**
 * Emits a schema.org block for search engines.
 *
 * `JSON.stringify` is what makes this safe to put through
 * dangerouslySetInnerHTML: the value is built by our own pure functions in
 * `structured-data.ts` from database strings, and stringify escapes anything
 * inside them. The one sequence it does not escape is `</script`, which would
 * close the tag early — so that is handled explicitly below.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      // Next renders this verbatim; there is no JSX equivalent for a script
      // body, and a text child would be HTML-escaped into invalid JSON.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
