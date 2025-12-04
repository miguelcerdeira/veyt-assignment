<script lang="ts">
  import { goto } from "$app/navigation";
  let company = "";

  function searchCompany() {
    const term = company.trim();
    if (!term) return;
    goto(`/company/${encodeURIComponent(term)}`);
  }
</script>

<div class="wrapper">
  <section class="hero">
    <h1>Veyt Assignment</h1>
    <div class="search">
      <input
        type="text"
        bind:value={company}
        placeholder="Search by company name or stock symbol (e.g. Microsoft, MSFT, Apple, AAPL)"
        on:keydown={(e) => e.key === "Enter" && searchCompany()}
      />
      <button on:click={searchCompany}>Search</button>
    </div>
  </section>
</div>

<style>
  .wrapper {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    justify-items: center;
    place-items: center;
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
    box-sizing: border-box;
    overflow: auto;
  }
  .hero {
    height: fit-content;
  }
  h1 {
    font-size: 2.5rem;
    margin: 0 0 2rem 0;
  }
  .search {
    display: flex;
    gap: 0.5rem;
    width: min(600px, 90vw);
    background: #2c3550;
    padding: 0.5rem;
    border-radius: 999px;
    border: 2px solid #38e5c0;
  }
  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: #fff;
    font-size: 1rem;
    padding: 0.75rem 1rem;
  }
  button {
    border-radius: 999px;
    border: 1px solid #38e5c0;
    background: #213040;
    color: #38e5c0;
    padding: 0.5rem 1rem;
    cursor: pointer;
  }
  button:hover {
    background: #1a2532;
  }
</style>
