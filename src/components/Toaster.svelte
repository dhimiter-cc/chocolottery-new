<script lang="ts">
  import { toasts } from '../lib/toast.svelte.js';
</script>

{#each toasts as t (t.id)}
  <div class="toast">{t.msg}</div>
{/each}
