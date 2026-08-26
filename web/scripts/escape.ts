// names come from spotify and anyone can name a playlist <script>
export const escapeHtml = (s: string | undefined) =>
  (s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
