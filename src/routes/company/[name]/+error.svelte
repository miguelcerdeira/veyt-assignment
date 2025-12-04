<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  export let error;
  export let status;
  
  function goBack() {
    goto('/');
  }
</script>

<div class="error-wrapper">
  <section class="error">
    <h1>Error Loading Company Data</h1>
    <p class="error-message">{error?.message || 'An unexpected error occurred'}</p>
    <p class="search-term">Search term: <strong>{$page.params.name}</strong></p>
    <button on:click={goBack}>Go Back to Search</button>
  </section>
</div>

<style>
  .error-wrapper {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: radial-gradient(
      1200px 500px at 50% -100%,
      #3c1f82 0%,
      #182238 35%,
      #121a26 60%,
      #0d1621 100%
    );
    color: #fff;
    text-align: center;
    padding: 2rem;
  }
  
  .error {
    max-width: 600px;
    background: rgba(44, 53, 80, 0.8);
    padding: 2rem;
    border-radius: 12px;
    border: 2px solid #e46357;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: #e46357;
  }
  
  .error-message {
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: #ff9999;
  }
  
  .search-term {
    font-size: 0.9rem;
    margin-bottom: 2rem;
    color: #ccc;
  }
  
  button {
    border-radius: 999px;
    border: 1px solid #38e5c0;
    background: #213040;
    color: #38e5c0;
    padding: 0.75rem 2rem;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }
  
  button:hover {
    background: #1a2532;
  }
</style>
